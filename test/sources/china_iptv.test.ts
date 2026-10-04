import { describe, expect, it } from 'vitest';

import {
  china_iptv_filter,
  china_iptv_sources,
  LAN_IP_PREFIXES,
  parseChinaIptvFileName,
  replaceWithLanProxyUrl,
} from '../../src/sources/china_iptv';
import { normalizeSourceFilterResults } from '../../src/sources/utils';

const raw = [
  '央视,#genre#',
  'CCTV1,rtp://239.3.1.129:8008',
  'CCTV2,',
  '卫视,#genre#',
  '北京卫视,udp://239.3.1.241:8000',
  '外网,http://example.com/live.m3u8',
].join('\n');

const filter = (filename: string) =>
  normalizeSourceFilterResults(china_iptv_filter(raw, 'skip', undefined, filename));

describe('china_iptv_filter', () => {
  it('converts genre txt to m3u and skips empty urls', () => {
    const [result] = filter('iptv/unicast/hebei/unicom');

    expect(result.filename).toBe('iptv/unicast/hebei/unicom');
    expect(result.channelCount).toBe(3);
    expect(result.m3u).toContain('group-title="央视",CCTV1\nrtp://239.3.1.129:8008');
    expect(result.m3u).toContain('group-title="卫视",北京卫视');
    expect(result.m3u).not.toContain('CCTV2');
  });

  it('creates only the raw result for unicast sources', () => {
    expect(filter('iptv/unicast/hebei/unicom')).toHaveLength(1);
  });

  it('creates one LAN proxy result per gateway for multicast sources', () => {
    const results = filter('iptv/multicast/hebei/unicom');

    expect(LAN_IP_PREFIXES).toHaveLength(13);
    expect(results).toHaveLength(1 + 13);
    expect(results.map(({ filename }) => filename)).toEqual([
      'iptv/multicast/hebei/unicom',
      ...LAN_IP_PREFIXES.map((p) => `iptv/multicast/hebei/unicom_${p.replace(/\./g, '_')}`),
    ]);

    const proxied = results.find(({ filename }) => filename.endsWith('_192_168_1'));
    expect(proxied?.m3u).toContain('http://192.168.1.1:23234/rtp/239.3.1.129:8008');
    expect(proxied?.m3u).toContain('http://192.168.1.1:23234/udp/239.3.1.241:8000');
    expect(proxied?.m3u).toContain('http://example.com/live.m3u8');
    expect(proxied?.channelCount).toBe(3);
  });
});

describe('replaceWithLanProxyUrl', () => {
  it('only rewrites rtp and udp urls', () => {
    expect(replaceWithLanProxyUrl('rtp://239.0.0.1:1234', '10.0.0')).toBe(
      'http://10.0.0.1:23234/rtp/239.0.0.1:1234'
    );
    expect(replaceWithLanProxyUrl('rtsp://1.2.3.4/live', '10.0.0')).toBe('rtsp://1.2.3.4/live');
  });
});

describe('parseChinaIptvFileName', () => {
  it('parses iptv file names', () => {
    expect(parseChinaIptvFileName('iptv/multicast/guangdong/broadent')).toEqual({
      type: 'multicast',
      province: 'guangdong',
      operator: 'broadent',
    });
    expect(parseChinaIptvFileName('iptv/multicast/beijing/unicom_192_168_1')).toBeUndefined();
    expect(parseChinaIptvFileName('q_bj_iptv_unicom_m')).toBeUndefined();
  });
});

describe('china_iptv_sources', () => {
  it('lists every upstream file', () => {
    expect(china_iptv_sources).toHaveLength(189);
    expect(new Set(china_iptv_sources.map(({ f_name }) => f_name)).size).toBe(189);
    expect(china_iptv_sources).toContainEqual(
      expect.objectContaining({
        name: 'CHINA-IPTV 北京 联通 组播',
        f_name: 'iptv/multicast/beijing/unicom',
        url: 'https://raw.githubusercontent.com/xisohi/CHINA-IPTV/main/Multicast/beijing/unicom.txt',
      })
    );
    expect(china_iptv_sources.filter(({ f_name }) => f_name.endsWith('/broadent'))).toHaveLength(3);
  });
});
