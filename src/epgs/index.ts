// import { with_github_raw_url_proxy } from '../sources';
import type { TEPGSource } from './utils';

export const epgs_sources: TEPGSource[] = [
  // {
  //     name: "112114.xyz",
  //     f_name: "112114_xyz",
  //     url: "https://epg.112114.xyz/pp.xml",
  // },
  // {
  //     name: "fanmingming/live",
  //     f_name: "fmml",
  //     url: "https://raw.githubusercontent.com/fanmingming/live/main/e.xml",
  // },
  {
    name: '51zmt.top',
    f_name: '51zmt',
    url: 'https://m3u.ibert.me/epg/51zmt.xml',
  },
  {
    name: '51zmt.top cc',
    f_name: '51zmt_cc',
    url: 'https://m3u.ibert.me/epg/51zmt_cc.xml',
  },
  {
    name: '51zmt.top difang',
    f_name: '51zmt_df',
    url: 'https://m3u.ibert.me/epg/51zmt_df.xml',
  },
];
