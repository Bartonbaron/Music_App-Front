import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>

                {/* Domyślna strona logowania */}
                <Route path="/" element={<LoginPage />} />

                {/* Strona wyświetlana po zalogowaniu */}
                <Route path="/home" element={<HomePage />} />

            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);
