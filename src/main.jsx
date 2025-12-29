import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import TestPlayerPage from "./pages/TestPlayerPage.jsx";
import AlbumPage from "./pages/albums/AlbumPage.jsx";

import { AuthProvider } from "./contexts/AuthContext";
import { PlayerProvider } from "./contexts/PlayerContext";

import "./index.css";

import RegisterPage from "./pages/auth/RegisterPage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import HomePage from "./pages/home/HomePage.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <PlayerProvider>
                    <Routes>
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/login" element={<LoginPage />} />

                        {/* zabezpieczone */}
                        <Route element={<AppLayout />}>
                            <Route path="/home" element={<HomePage />} />
                        </Route>

                        {/* domyślne */}
                        <Route path="/" element={<Navigate to="/home" replace />} />
                        <Route path="*" element={<Navigate to="/home" replace />} />
                        <Route path="/test-player" element={<TestPlayerPage />} />
                        <Route path="/albums/:id" element={<AlbumPage />} />

                    </Routes>
                </PlayerProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);