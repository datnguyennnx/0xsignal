export declare const isDarkMode: () => boolean;
export declare const colors: {
  readonly gain: {
    readonly DEFAULT: "var(--gain)";
    readonly light: "var(--gain-light)";
    readonly dark: "var(--gain-dark)";
    readonly muted: "var(--gain-muted)";
  };
  readonly loss: {
    readonly DEFAULT: "var(--loss)";
    readonly light: "var(--loss-light)";
    readonly dark: "var(--loss-dark)";
    readonly muted: "var(--loss-muted)";
  };
  readonly warn: {
    readonly DEFAULT: "var(--warn)";
    readonly light: "var(--warn-light)";
    readonly dark: "var(--warn-dark)";
    readonly muted: "var(--warn-muted)";
  };
};
export declare const getChartColors: (isDark: boolean) => {
  bg: string;
  grid: string;
  text: string;
  border: string;
  crosshair: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  gain: string;
  gainLight: string;
  gainDark: string;
  loss: string;
  lossLight: string;
  lossDark: string;
  warn: string;
  volume: string;
  heatmap: {
    gainStrong: string;
    gain: string;
    gainLight: string;
    lossStrong: string;
    loss: string;
    lossLight: string;
    neutral: string;
    marker: string;
  };
};
export declare const getCandlestickColors: (isDark: boolean) => {
  upColor: string;
  downColor: string;
  wickUpColor: string;
  wickDownColor: string;
};
export declare const getVolumeColor: (isUp: boolean, isDark: boolean) => string;
export declare const getHeatmapColor: (change: number, isDark: boolean) => string;
export declare const getIndicatorColors: (isDark: boolean) => string[];
//# sourceMappingURL=colors.d.ts.map
