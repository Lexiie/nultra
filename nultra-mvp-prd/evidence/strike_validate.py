#!/usr/bin/env python3
"""Strike Alpha Foundry public API validation. No credentials, no trading writes."""
import argparse, csv, datetime as dt, hashlib, json, os, socket, ssl, sys, time, urllib.error, urllib.parse, urllib.request, zipfile
from pathlib import Path

PARSER = argparse.ArgumentParser(description=__doc__)
PARSER.add_argument('--env', choices=['mainnet','testnet'], default='mainnet')
PARSER.add_argument('--symbol', default='BTC-USD')
PARSER.add_argument('--timeout', type=float, default=12)
PARSER.add_argument('--ws-seconds', type=int, default=12)
PARSER.add_argument('--skip-ws', action='store_true')
PARSER.add_argument('--output', default='strike-validation')
a = PARSER.parse_args()
base = 'https://api.strikefinance.org' if a.env == 'mainnet' else 'https://api-v2-testnet.strikefinance.org'
ws_url = base.replace('https://','wss://')+'/ws/price'
folder = Path(a.output); folder.mkdir(parents=True, exist_ok=True)
results = []
USER_AGENT = 'StrikeAlphaFoundry-PublicValidation/1.0'

def save_json(name, data):
    (folder / name).write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str), encoding='utf-8')

def safe_shape(value):
    if isinstance(value, dict):
        return {'type':'object','keys':list(value.keys())[:35], 'sample':{k:safe_shape(v) for k,v in list(value.items())[:8]}}
    if isinstance(value, list):
        return {'type':'array','length':len(value),'first':safe_shape(value[0]) if value else None}
    return {'type':type(value).__name__, 'example':str(value)[:100]}

def fetch(label, path, params=None, retain=False):
    url = base + path
    if params: url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent':USER_AGENT,'Accept':'application/json'})
    record = {'test':label,'url':url,'timestamp_utc':dt.datetime.now(dt.timezone.utc).isoformat()}
    started = time.monotonic(); body=b''
    try:
        try:
            response=urllib.request.urlopen(req,timeout=a.timeout)
        except urllib.error.HTTPError as exc:
            response=exc
        with response:
            record['http_status']=response.status
            record['content_type']=response.headers.get('Content-Type','')
            body=response.read(2_000_000)
        record['elapsed_ms']=round((time.monotonic()-started)*1000)
        record['bytes']=len(body)
        record['sha256']=hashlib.sha256(body).hexdigest()
        try:
            parsed=json.loads(body)
            record['shape']=safe_shape(parsed)
            if retain: save_json(label+'.json',parsed)
            else:
                # limited sample; no auth endpoints used
                save_json(label+'.json',{'metadata':record,'sample':parsed[:3] if isinstance(parsed,list) else {k:v for k,v in list(parsed.items())[:12]}})
            record['_data']=parsed
        except (ValueError,UnicodeDecodeError):
            record['sample_text']=body[:250].decode('utf-8','replace')
        record['status']='OK' if 200<=record['http_status']<300 else 'HTTP_ERROR'
    except Exception as exc:
        record.update(status='NETWORK_ERROR',error=f'{type(exc).__name__}: {str(exc)[:300]}',elapsed_ms=round((time.monotonic()-started)*1000))
    results.append({k:v for k,v in record.items() if k!='_data'})
    print(f"[{record['status']:<13}] {label:<28} HTTP {record.get('http_status','-')} {record.get('elapsed_ms','-')}ms",flush=True)
    time.sleep(.25)
    return record

print('Strike Alpha Foundry public validation |',a.env,'|',a.symbol)
print('Read-only; no wallet keys or trading requests.\n')
# Documented public market/account metadata routes. Some are exploratory; errors recorded rather than treated as outages.
tests=[
 ('server_time','/v2/time',None),
 ('markets','/v2/markets',None),
 ('exchange_info','/price/v2/exchangeInfo',None),
 ('ticker_price','/price/v2/ticker/price',{'symbol':a.symbol}),
 ('book_ticker','/price/v2/ticker/bookTicker',{'symbol':a.symbol}),
 ('ticker_24h','/price/v2/ticker/24hr',{'symbol':a.symbol}),
 ('premium_index','/price/v2/premiumIndex',{'symbol':a.symbol}),
 ('mark_price','/price/v2/markPrice',{'symbol':a.symbol}),
 ('index_price','/price/v2/indexPrice',{'symbol':a.symbol}),
 ('open_interest','/price/v2/openInterest',{'symbol':a.symbol}),
 ('depth_20','/price/v2/depth',{'symbol':a.symbol,'limit':20}),
 ('depth_100','/price/v2/depth',{'symbol':a.symbol,'limit':100}),
 ('trades_recent','/price/v2/trades',{'symbol':a.symbol,'limit':100}),
 ('klines_1m','/price/v2/klines',{'symbol':a.symbol,'interval':'1m','limit':100}),
 ('klines_15m','/price/v2/klines',{'symbol':a.symbol,'interval':'15m','limit':100}),
 ('klines_1h','/price/v2/klines',{'symbol':a.symbol,'interval':'1h','limit':100}),
 ('klines_1d','/price/v2/klines',{'symbol':a.symbol,'interval':'1d','limit':100}),
 ('l3_snapshot_exploratory','/v2/l3/snapshot',{'symbol':a.symbol}),
]
cache={}
for label,path,params in tests:
    cache[label]=fetch(label,path,params,retain=(label.startswith('klines_') or label in ('exchange_info','markets','depth_20')))

# Probe historical start/end parameters without assuming that the server supports them.
now=dt.datetime.now(dt.timezone.utc)
for days in (7,30,90,180,365):
    start=int((now-dt.timedelta(days=days)).timestamp()*1000)
    r=fetch(f'klines_start_{days}d','/price/v2/klines',{'symbol':a.symbol,'interval':'1h','startTime':start,'limit':100},retain=True)
    cache[f'klines_start_{days}d']=r
# Alternative time-window probe (some APIs use endTime).
cache['klines_end_90d']=fetch('klines_end_90d','/price/v2/klines',{'symbol':a.symbol,'interval':'1h','endTime':int((now-dt.timedelta(days=90)).timestamp()*1000),'limit':100},retain=True)

def extract_candles(data):
    if isinstance(data,list): return data
    if isinstance(data,dict):
        for k in ('data','klines','candles','result'):
            if isinstance(data.get(k),list):return data[k]
    return []

def candle_stats(data, interval_minutes):
    rows=extract_candles(data)
    stamps=[]; invalid_ohlc=0
    for x in rows:
        try:
            if isinstance(x,list):
                t=int(x[0]); o,h,l,c=map(float,x[1:5])
            elif isinstance(x,dict):
                t=int(next(x[k] for k in ('openTime','open_time','t','time','timestamp') if k in x))
                o=float(x.get('open',x.get('o'))); h=float(x.get('high',x.get('h'))); l=float(x.get('low',x.get('l'))); c=float(x.get('close',x.get('c')))
            else:continue
            if t<10**11:t*=1000
            stamps.append(t)
            if min(o,h,l,c)<=0 or h<max(o,c,l) or l>min(o,c,h):invalid_ohlc+=1
        except (ValueError,TypeError,StopIteration):continue
    unique=sorted(set(stamps)); step=interval_minutes*60000
    gaps=sum(max(0,round((b-a)/step)-1) for a,b in zip(unique,unique[1:]) if b>a)
    return {'returned':len(rows),'parsed':len(stamps),'duplicates':len(stamps)-len(unique),'missing_intervals_estimate':gaps,'invalid_ohlc':invalid_ohlc,'earliest_utc':dt.datetime.fromtimestamp(unique[0]/1000,dt.timezone.utc).isoformat() if unique else None,'latest_utc':dt.datetime.fromtimestamp(unique[-1]/1000,dt.timezone.utc).isoformat() if unique else None}

stats={}
for key,r in cache.items():
    if key.startswith('klines_') and '_data' in r:
        interval=1 if key=='klines_1m' else 15 if key=='klines_15m' else 1440 if key=='klines_1d' else 60
        stats[key]=candle_stats(r['_data'],interval)
save_json('candle_audit.json',stats)

# WebSocket public read-only subscriptions; optional dependency.
ws_result={'url':ws_url,'status':'SKIPPED','duration_seconds':a.ws_seconds}
if not a.skip_ws:
    try:
        from websocket import create_connection
        connection=create_connection(ws_url,timeout=a.timeout,header=[f'User-Agent: {USER_AGENT}'])
        channels=['markprice','depth','trade','kline_1m','miniticker']
        for i,ch in enumerate(channels,1):
            connection.send(json.dumps({'method':'subscribe','channel':ch,'symbol':a.symbol,'id':i}))
        counts={}; samples={}; messages=0; deadline=time.monotonic()+a.ws_seconds
        while time.monotonic()<deadline and messages<250:
            connection.settimeout(min(2,max(.1,deadline-time.monotonic())))
            try: raw=connection.recv()
            except socket.timeout:continue
            messages+=1
            try: payload=json.loads(raw)
            except ValueError:payload={'raw':str(raw)[:150]}
            kind=payload.get('e',payload.get('channel',payload.get('method','other'))) if isinstance(payload,dict) else 'array'
            counts[kind]=counts.get(kind,0)+1
            if kind not in samples:samples[kind]=safe_shape(payload)
        connection.close()
        ws_result.update(status='OK',messages=messages,event_counts=counts,event_shapes=samples)
    except ImportError:
        ws_result.update(status='DEPENDENCY_MISSING',error='Install: python -m pip install websocket-client')
    except Exception as exc:
        ws_result.update(status='ERROR',error=f'{type(exc).__name__}: {str(exc)[:300]}')
print('[WEBSOCKET]',ws_result['status'],ws_result.get('event_counts',ws_result.get('error','')))
save_json('websocket.json',ws_result)

with (folder/'endpoint_results.csv').open('w',newline='',encoding='utf-8') as f:
    writer=csv.DictWriter(f,fieldnames=['test','url','status','http_status','elapsed_ms','bytes','error'],extrasaction='ignore')
    writer.writeheader();writer.writerows(results)
save_json('summary.json',{'environment':a.env,'symbol':a.symbol,'timestamp_utc':now.isoformat(),'python':sys.version.split()[0],'endpoints':results,'candle_audit':stats,'websocket':ws_result,'note':'Read-only public endpoints; a 4xx does not necessarily imply the service is down. StartTime probe does not prove pagination unless timestamps vary.'})
(folder/'README.txt').write_text('Strike Alpha Foundry validation\nPublic, read-only API requests only. No API keys or wallet secrets.\nCheck summary.json, candle_audit.json, websocket.json and endpoint_results.csv.\nTimestamp coverage may be misleading if server ignores startTime/endTime.\n',encoding='utf-8')
archive=folder.with_suffix('.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in folder.rglob('*'):
        if p.is_file():z.write(p,arcname=str(p.relative_to(folder.parent)))
print('\nDone. Upload:',archive.resolve())
