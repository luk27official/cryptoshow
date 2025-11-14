import { useState, useEffect } from "react";

type Theme = "light" | "dark";

export const useTheme = () => {
    const [theme, setTheme] = useState<Theme>(() => {
        const savedTheme = localStorage.getItem("theme") as Theme | null;
        if (savedTheme) {
            return savedTheme;
        }

        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    });

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => {
            const newTheme = prevTheme === "light" ? "dark" : "light";

            if (window.location.pathname === "/viewer") {
                setTimeout(() => window.location.reload(), 0);
            }

            return newTheme;
        });
    };

    return { theme, toggleTheme };
};

export const getCurrentTheme = () => {
    const dataTheme = document.documentElement.getAttribute("data-theme");
    if (dataTheme) return dataTheme as "light" | "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
