export const getApiUrl = (path: string) => {
    return `./api${path}`;
};

export const getColorString = (value: number) => {
    const color = getColor(value);
    return `#${color.toString(16).padStart(6, "0")}`;
};

export const getColor = (value: number) => {
    const vFl = Math.floor(value);
    return defaultColors[vFl % defaultColors.length];
};

// https://davidmathlogic.com/colorblind/#%23332288-%23117733-%2344AA99-%2388CCEE-%23DDCC77-%23CC6677-%23AA4499-%23882255
const defaultColors = [
    0x332288,
    0x117733,
    0x44aa99,
    0x88ccee,
    0xddcc77,
    0xcc6677,
    0xaa4499,
    0x882255,
];

export const COMPLETED_TASKS_KEY = "completedTasks";

export const getWindowWidth = () => {
    return window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
};
