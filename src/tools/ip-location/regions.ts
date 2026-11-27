/**
 * 中文地名映射（尽力而为）。
 *
 * Cloudflare 边缘节点只返回英文名（`Guangdong` / `Shenzhen`），中文界面下需要本地化。
 * 省级行政区覆盖完整；城市只收录常见城市，表里没有的保持原样返回——宁可显示英文，
 * 也不要做音译猜测，因为错误的城市名比一个英文名更容易误导人。
 */

const PROVINCES: Record<string, string> = {
  beijing: '北京市',
  tianjin: '天津市',
  hebei: '河北省',
  shanxi: '山西省',
  'inner mongolia': '内蒙古自治区',
  neimenggu: '内蒙古自治区',
  liaoning: '辽宁省',
  jilin: '吉林省',
  heilongjiang: '黑龙江省',
  shanghai: '上海市',
  jiangsu: '江苏省',
  zhejiang: '浙江省',
  anhui: '安徽省',
  fujian: '福建省',
  jiangxi: '江西省',
  shandong: '山东省',
  henan: '河南省',
  hubei: '湖北省',
  hunan: '湖南省',
  guangdong: '广东省',
  guangxi: '广西壮族自治区',
  hainan: '海南省',
  chongqing: '重庆市',
  sichuan: '四川省',
  guizhou: '贵州省',
  yunnan: '云南省',
  tibet: '西藏自治区',
  xizang: '西藏自治区',
  shaanxi: '陕西省',
  gansu: '甘肃省',
  qinghai: '青海省',
  ningxia: '宁夏回族自治区',
  xinjiang: '新疆维吾尔自治区',
  'hong kong': '香港特别行政区',
  macau: '澳门特别行政区',
  macao: '澳门特别行政区',
  taiwan: '台湾省',
};

const CITIES: Record<string, string> = {
  beijing: '北京市',
  shanghai: '上海市',
  tianjin: '天津市',
  chongqing: '重庆市',
  guangzhou: '广州市',
  shenzhen: '深圳市',
  dongguan: '东莞市',
  foshan: '佛山市',
  zhuhai: '珠海市',
  zhongshan: '中山市',
  huizhou: '惠州市',
  shantou: '汕头市',
  jiangmen: '江门市',
  hangzhou: '杭州市',
  ningbo: '宁波市',
  wenzhou: '温州市',
  jiaxing: '嘉兴市',
  nanjing: '南京市',
  suzhou: '苏州市',
  wuxi: '无锡市',
  changzhou: '常州市',
  nantong: '南通市',
  xuzhou: '徐州市',
  wuhan: '武汉市',
  yichang: '宜昌市',
  xiangyang: '襄阳市',
  changsha: '长沙市',
  zhuzhou: '株洲市',
  hengyang: '衡阳市',
  chengdu: '成都市',
  mianyang: '绵阳市',
  xian: '西安市',
  'xi an': '西安市',
  xianyang: '咸阳市',
  zhengzhou: '郑州市',
  luoyang: '洛阳市',
  jinan: '济南市',
  qingdao: '青岛市',
  yantai: '烟台市',
  weifang: '潍坊市',
  shenyang: '沈阳市',
  dalian: '大连市',
  changchun: '长春市',
  harbin: '哈尔滨市',
  shijiazhuang: '石家庄市',
  taiyuan: '太原市',
  hefei: '合肥市',
  wuhu: '芜湖市',
  nanchang: '南昌市',
  ganzhou: '赣州市',
  fuzhou: '福州市',
  xiamen: '厦门市',
  quanzhou: '泉州市',
  nanning: '南宁市',
  guilin: '桂林市',
  haikou: '海口市',
  sanya: '三亚市',
  guiyang: '贵阳市',
  kunming: '昆明市',
  lhasa: '拉萨市',
  lanzhou: '兰州市',
  xining: '西宁市',
  yinchuan: '银川市',
  urumqi: '乌鲁木齐市',
  hohhot: '呼和浩特市',
  baotou: '包头市',
  'hong kong': '香港特别行政区',
  macau: '澳门特别行政区',
  macao: '澳门特别行政区',
  taipei: '台北市',
};

function lookup(table: Record<string, string>, name: string): string | undefined {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return undefined;
  return table[key] ?? table[key.replace(/[.'’]/g, '')];
}

/** 英文省名 → 中文省名；未收录时返回 undefined（调用方回退原文） */
export function zhProvince(name: string): string | undefined {
  return lookup(PROVINCES, name);
}

/** 英文城市名 → 中文城市名；未收录时返回 undefined（调用方回退原文） */
export function zhCity(name: string): string | undefined {
  return lookup(CITIES, name);
}
