import { collectM3uSource } from '../utils';
import {
  default_txt_filter,
  ISource,
  normalizeSourceFilterResults,
  type TSourceFilterResult,
  type TSources,
} from './utils';

export const CHINA_IPTV_SOURCE_PREFIX = 'CHINA-IPTV';
export const CHINA_IPTV_DIR = 'iptv';

export type TChinaIptvType = 'multicast' | 'unicast';
export type TChinaIptvOperator = 'telecom' | 'unicom' | 'mobile' | 'broadent';

export const CHINA_IPTV_TYPES: Record<
  TChinaIptvType,
  { label: string; icon: string; dir: string }
> = {
  multicast: { label: '组播', icon: '🛰️', dir: 'Multicast' },
  unicast: { label: '单播', icon: '🔗', dir: 'Unicast' },
};

export const CHINA_IPTV_OPERATORS: Record<TChinaIptvOperator, string> = {
  telecom: '电信',
  unicom: '联通',
  mobile: '移动',
  broadent: '广电',
};

export const CHINA_IPTV_PROVINCES: Record<string, string> = {
  beijing: '北京',
  tianjin: '天津',
  hebei: '河北',
  shanxi: '山西',
  neimenggu: '内蒙古',
  liaoning: '辽宁',
  jilin: '吉林',
  heilongjiang: '黑龙江',
  shanghai: '上海',
  jiangsu: '江苏',
  zhejiang: '浙江',
  anhui: '安徽',
  fujian: '福建',
  jiangxi: '江西',
  shandong: '山东',
  henan: '河南',
  hubei: '湖北',
  hunan: '湖南',
  guangdong: '广东',
  guangxi: '广西',
  hainan: '海南',
  chongqing: '重庆',
  sichuan: '四川',
  guizhou: '贵州',
  yunnan: '云南',
  xizang: '西藏',
  shaanxi: '陕西',
  gansu: '甘肃',
  qinghai: '青海',
  ningxia: '宁夏',
  xinjiang: '新疆',
};

/** 上游提供的运营商 logo，文件名与 TChinaIptvOperator 一致 */
export const getChinaIptvOperatorLogo = (operator: TChinaIptvOperator) =>
  `https://chinaiptv.pages.dev/logo/${operator}.png`;

/** 上游仅这几个省份提供广电组播源 */
const BROADENT_MULTICAST_PROVINCES = ['guangdong', 'shandong', 'sichuan'];

/** 常见路由器网关网段，组播源会为每个网段生成一份走 udpxy/rtp2httpd 代理的版本 */
export const LAN_IP_PREFIXES = [
  ...Array.from({ length: 11 }, (_, index) => `192.168.${index}`),
  '192.168.123',
  '10.0.0',
];

export const replaceWithLanProxyUrl = (url: string, lanIpPrefix: string) => {
  const match = /^(rtp|udp):\/\/(.+)$/.exec(url);
  if (!match) return url;

  return `http://${lanIpPrefix}.1:23234/${match[1]}/${match[2]}`;
};

export interface IChinaIptvMeta {
  type: TChinaIptvType;
  province: string;
  operator: TChinaIptvOperator;
}

export const getChinaIptvFileName = ({ type, province, operator }: IChinaIptvMeta) =>
  `${CHINA_IPTV_DIR}/${type}/${province}/${operator}`;

/** 从 `iptv/{type}/{province}/{operator}` 文件名中解析出元数据 */
export const parseChinaIptvFileName = (f_name: string): IChinaIptvMeta | undefined => {
  const match = new RegExp(`^${CHINA_IPTV_DIR}/(multicast|unicast)/([a-z]+)/([a-z]+)$`).exec(
    f_name
  );
  if (!match || !(match[3] in CHINA_IPTV_OPERATORS)) return undefined;

  return {
    type: match[1] as TChinaIptvType,
    province: match[2],
    operator: match[3] as TChinaIptvOperator,
  };
};

export const china_iptv_filter: ISource['filter'] = (
  raw,
  caller,
  collectFn,
  filename
): TSourceFilterResult[] => {
  const meta = parseChinaIptvFileName(filename);
  const [result] = normalizeSourceFilterResults(
    default_txt_filter(raw, caller, collectFn, filename)
  );
  if (meta?.type !== 'multicast') {
    return [result];
  }

  const lines = result.m3u.split('\n');
  return [result].concat(
    LAN_IP_PREFIXES.map((lanIpPrefix) => {
      const proxied = lines.map((line, index) =>
        index > 0 && index % 2 === 0 ? replaceWithLanProxyUrl(line, lanIpPrefix) : line
      );

      if (caller === 'normal' && collectFn) {
        for (let i = 1; i < proxied.length; i += 2) {
          collectM3uSource(proxied[i], proxied[i + 1], collectFn);
        }
      }

      return {
        filename: `${filename}_${lanIpPrefix.replace(/\./g, '_')}`,
        m3u: proxied.join('\n'),
        channelCount: result.channelCount,
      };
    })
  );
};

const createSource = (meta: IChinaIptvMeta): ISource => ({
  name: `${CHINA_IPTV_SOURCE_PREFIX} ${CHINA_IPTV_PROVINCES[meta.province]} ${
    CHINA_IPTV_OPERATORS[meta.operator]
  } ${CHINA_IPTV_TYPES[meta.type].label}`,
  f_name: getChinaIptvFileName(meta),
  url: `https://raw.githubusercontent.com/xisohi/CHINA-IPTV/main/${
    CHINA_IPTV_TYPES[meta.type].dir
  }/${meta.province}/${meta.operator}.txt`,
  filter: china_iptv_filter,
});

export const china_iptv_sources: TSources = (
  Object.keys(CHINA_IPTV_TYPES) as TChinaIptvType[]
).flatMap((type) =>
  Object.keys(CHINA_IPTV_PROVINCES).flatMap((province) =>
    (Object.keys(CHINA_IPTV_OPERATORS) as TChinaIptvOperator[])
      .filter(
        (operator) =>
          operator !== 'broadent' ||
          (type === 'multicast' && BROADENT_MULTICAST_PROVINCES.includes(province))
      )
      .map((operator) => createSource({ type, province, operator }))
  )
);
