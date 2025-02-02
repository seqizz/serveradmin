const darkMode = {
    init() {
        // Check if dark mode preference exists in localStorage
        if (localStorage.getItem("darkMode") === null) {
            // Check system preference
            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                document.documentElement.setAttribute("data-theme", "dark");
                localStorage.setItem("darkMode", "dark");
            } else {
                document.documentElement.setAttribute("data-theme", "light");
                localStorage.setItem("darkMode", "light");
            }
        } else {
            // Use stored preference
            document.documentElement.setAttribute(
                "data-theme",
                localStorage.getItem("darkMode"),
            );
        }

        // Set checkbox state
        const checkbox = document.getElementById("dark_mode");
        if (checkbox) {
            checkbox.checked = localStorage.getItem("darkMode") === "dark";
        }
    },

    toggle() {
        const checkbox = document.getElementById("dark_mode");
        const newTheme = checkbox.checked ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("darkMode", newTheme);
    },
};

// Initialize dark mode when DOM is loaded
document.addEventListener("DOMContentLoaded", darkMode.init);
