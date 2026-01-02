import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PublicOnlyRoute from "./components/common/PublicOnlyRoute";

import { AuthProvider } from "./contexts/AuthContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import { LibraryProvider } from "./contexts/LibraryContext.jsx";

import AppLayout from "./components/layout/AppLayout";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import HomePage from "./pages/home/HomePage";
import TestPlayerPage from "./pages/TestPlayerPage";
import AlbumPage from "./pages/albums/AlbumPage";
import PlaylistPage from "./pages/playlists/PlaylistPage.jsx";
import LikedSongsPage from "./pages/LikedSongsPage.jsx";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <PlayerProvider>
                    <LibraryProvider>
                    <Routes>
                        {/* publiczne */}
                        <Route element={<PublicOnlyRoute />}>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        </Route>

                        {/* chronione */}
                        <Route element={<AppLayout />}>
                            <Route path="/home" element={<HomePage />} />
                            <Route path="/test-player" element={<TestPlayerPage />} />
                            <Route path="/playlists/:id" element={<PlaylistPage />} />
                            <Route path="/albums/:id" element={<AlbumPage />} />
                            <Route path="/library" element={<HomePage />} />
                            <Route path="/liked" element={<LikedSongsPage />} />
                        </Route>

                        {/* domyślne */}
                        <Route path="/" element={<Navigate to="/home" replace />} />
                        <Route path="*" element={<Navigate to="/home" replace />} />
                    </Routes>
                    </LibraryProvider>
                </PlayerProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
