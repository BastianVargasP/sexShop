tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary-container": "#4b0082",
                "inverse-primary": "#7b41b3",
                "on-tertiary-container": "#9b9998",
                "on-error": "#690005",
                "on-surface": "#e5e2e1",
                "outline": "#978d9d",
                "primary": "#ddb7ff",
                "on-primary": "#4a0080",
                "secondary-container": "#af8d11",
                "on-primary-fixed": "#2c0050",
                "surface-dim": "#131313",
                "error": "#ffb4ab",
                "secondary-fixed": "#ffe088",
                "outline-variant": "#4c4451",
                "tertiary-container": "#313131",
                "surface-tint": "#ddb7ff",
                "on-tertiary-fixed-variant": "#474746",
                "error-container": "#93000a",
                "surface-container-low": "#1c1b1b",
                "secondary": "#e9c349",
                "background": "#131313",
                "surface-container-lowest": "#0e0e0e",
                "surface-container-high": "#2a2a2a",
                "inverse-surface": "#e5e2e1",
                "on-surface-variant": "#cec3d3",
                "on-primary-container": "#ba7ef4",
                "on-secondary": "#3c2f00",
                "on-primary-fixed-variant": "#622599",
                "on-secondary-fixed": "#241a00",
                "surface-container": "#201f1f",
                "on-background": "#e5e2e1",
                "surface": "#131313",
                "surface-bright": "#3a3939",
                "primary-fixed": "#f0dbff",
                "surface-variant": "#353534",
                "tertiary-fixed-dim": "#c8c6c5",
                "on-secondary-fixed-variant": "#574500",
                "tertiary-fixed": "#e5e2e1",
                "secondary-fixed-dim": "#e9c349",
                "on-tertiary": "#313030",
                "surface-container-highest": "#353534",
                "on-tertiary-fixed": "#1c1b1b",
                "on-error-container": "#ffdad6",
                "inverse-on-surface": "#313030",
                "tertiary": "#c8c6c5",
                "on-secondary-container": "#342800",
                "primary-fixed-dim": "#ddb7ff"
            },
            borderRadius: {
                DEFAULT: "0.125rem",
                lg: "0.25rem",
                xl: "0.5rem",
                full: "0.75rem"
            },
            spacing: {
                unit: "8px",
                "margin-desktop": "64px",
                "container-max": "1280px",
                "gutter": "24px",
                "margin-mobile": "20px"
            },
            fontFamily: {
                "body-lg": ["Hanken Grotesk"],
                "body-md": ["Hanken Grotesk"],
                "label-sm": ["Hanken Grotesk"],
                "label-md": ["Hanken Grotesk"],
                "headline-md": ["Playfair Display"],
                "headline-lg": ["Playfair Display"],
                "headline-lg-mobile": ["Playfair Display"],
                "headline-xl": ["Playfair Display"]
            },
            fontSize: {
                "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
                "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
                "label-sm": ["12px", { lineHeight: "1.2", fontWeight: "500" }],
                "label-md": ["14px", { lineHeight: "1.2", letterSpacing: "0.1em", fontWeight: "600" }],
                "headline-md": ["32px", { lineHeight: "1.3", fontWeight: "500" }],
                "headline-lg": ["48px", { lineHeight: "1.2", fontWeight: "600" }],
                "headline-lg-mobile": ["32px", { lineHeight: "1.2", fontWeight: "600" }],
                "headline-xl": ["60px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }]
            }
        }
    }
};
