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
import PodcastsPage from "./pages/podcasts/PodcastsPage.jsx";
import PodcastPage from "./pages/podcasts/PodcastPage.jsx";
import MyEpisodesPage from "./pages/podcasts/MyEpisodesPage.jsx";
import LikedSongsPage from "./pages/LikedSongsPage.jsx";
import PlayHistoryPage from "./pages/history/PlayHistoryPage.jsx";
import SongsPage from "./pages/songs/SongsPage.jsx";
import SongPage from "./pages/songs/SongPage.jsx";
import UserPage from "./pages/users/UserPage.jsx";
import PublicUserPage from "./pages/users/PublicUserPage";
import CreatorPage from "./pages/creators/CreatorPage.jsx";
import PublicCreatorPage from "./pages/creators/PublicCreatorPage.jsx";

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
                            <Route path="/podcasts" element={<PodcastsPage />} />
                            <Route path="/podcasts/:id" element={<PodcastPage />} />
                            <Route path="/my-episodes" element={<MyEpisodesPage />} />
                            <Route path="/albums/:id" element={<AlbumPage />} />
                            <Route path="/library" element={<HomePage />} />
                            <Route path="/songs" element={<SongsPage />} />
                            <Route path="/songs/:id" element={<SongPage />} />
                            <Route path="/liked-songs" element={<LikedSongsPage />} />
                            <Route path="/history" element={<PlayHistoryPage />} />
                            <Route path="/me" element={<UserPage />} />
                            <Route path="/users/:id" element={<PublicUserPage/>} />
                            <Route path="/creator/me" element={<CreatorPage/>} />
                            <Route path="/creators/:id" element={<PublicCreatorPage />} />
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
