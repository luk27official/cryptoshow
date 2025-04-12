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

// TODO: change the default colors to a more suitable set
const defaultColors = [
    0xff0000,
    0xff8000,
    0xffff00,
    0x80ff00,
    0x00ff00,
];

export const COMPLETED_TASKS_KEY = "completedTasks";

export const getWindowWidth = () => {
    return window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
};
