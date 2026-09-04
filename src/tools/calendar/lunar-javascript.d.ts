declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getFestivals(): string[];
    getOtherFestivals(): string[];
    getLunar(): Lunar;
  }

  export class Lunar {
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getFestivals(): string[];
    getOtherFestivals(): string[];
    getJieQi(): string;
    getDayYi(): string[];
    getDayJi(): string[];
    getDayInGanZhi(): string;
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getYearShengXiao(): string;
    toString(): string;
  }

  export class Holiday {
    getName(): string;
    isWork(): boolean;
    getTarget(): string;
    getDay(): string;
  }

  export const HolidayUtil: {
    getHoliday(year: number, month: number, day: number): Holiday | undefined;
  };

  export const I18n: {
    getLanguage(): string;
    setLanguage(lang: string): void;
  };
}
