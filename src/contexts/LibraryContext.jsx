import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useAuth } from "./AuthContext";

const LibraryContext = createContext(null);

export function LibraryProvider({ children }) {
    const { token } = useAuth();

    const [albums, setAlbums] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [favoriteSongs, setFavoriteSongs] = useState([]);
    const [favoritePodcasts, setFavoritePodcasts] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const abortRef = useRef(null);

    const reset = useCallback(() => {
        setAlbums([]);
        setPlaylists([]);
        setFavoriteSongs([]);
        setFavoritePodcasts([]);
        setLoading(false);
        setError("");
    }, []);

    const refetch = useCallback(async () => {
        if (!token) return;

        // cancel poprzedniego requestu
        try {
            abortRef.current?.abort();
            // eslint-disable-next-line no-unused-vars
        } catch (_) {
            /* noop */
        }

        const ac = new AbortController();
        abortRef.current = ac;

        setLoading(true);
        setError("");

        try {
            const [likedRes, favPodsRes, albumsRes, playlistsRes] = await Promise.all([
                fetch("http://localhost:3000/api/libraries/liked-songs", {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                }),
                fetch("http://localhost:3000/api/libraries/favorite-podcasts", {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                }),
                fetch("http://localhost:3000/api/libraries/albums", {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                }),
                fetch("http://localhost:3000/api/libraries/playlists/list", {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                }),
            ]);

            const likedData = await likedRes.json().catch(() => ({}));
            const favPodsData = await favPodsRes.json().catch(() => ({}));
            const albumsData = await albumsRes.json().catch(() => ({}));
            const playlistsData = await playlistsRes.json().catch(() => ({}));

            if (!likedRes.ok) {
                throw new Error(likedData?.message || "Failed to fetch liked songs");
            }
            if (!favPodsRes.ok) {
                throw new Error(favPodsData?.message || "Failed to fetch favorite podcasts");
            }
            if (!albumsRes.ok) {
                throw new Error(albumsData?.message || "Failed to fetch library albums");
            }
            if (!playlistsRes.ok) {
                throw new Error(playlistsData?.message || "Failed to fetch library playlists");
            }

            // Single source of truth:
            // - liked songs -> /libraries/liked-songs
            // - favorite podcasts -> /libraries/favorite-podcasts
            setFavoriteSongs(Array.isArray(likedData) ? likedData : likedData.songs || []);
            setFavoritePodcasts(Array.isArray(favPodsData) ? favPodsData : favPodsData.podcasts || []);

            setAlbums(Array.isArray(albumsData) ? albumsData : albumsData.albums || []);
            setPlaylists(Array.isArray(playlistsData) ? playlistsData : playlistsData.playlists || []);
        } catch (e) {
            if (e?.name === "AbortError") return;
            setError(e?.message || "Library error");
        } finally {
            setLoading(false);
        }
    }, [token]);

    // -------- LIKED SONGS --------
    const toggleSongLike = useCallback(
        async (songID, isLiked) => {
            if (!token) return { success: false, message: "Brak tokenu" };
            if (!songID) return { success: false, message: "Brak songID" };

            try {
                const res = await fetch(
                    `http://localhost:3000/api/songs/${songID}/${isLiked ? "unlike" : "like"}`,
                    {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { success: false, message: data?.message || "Like update failed" };

                await refetch();
                return { success: true, likeCount: data?.likeCount };
            } catch (e) {
                return { success: false, message: e?.message || "Network error" };
            }
        },
        [token, refetch]
    );

    const likedSongIds = useMemo(() => {
        const set = new Set();
        (favoriteSongs || []).forEach((s) => {
            const id = s?.songID ?? s?.song?.songID;
            if (id != null) set.add(String(id));
        });
        return set;
    }, [favoriteSongs]);

    // -------- FAVORITE PODCASTS / "MOJE ODCINKI" --------
    const favoritePodcastIds = useMemo(() => {
        const set = new Set();
        (favoritePodcasts || []).forEach((p) => {
            const id = p?.podcastID ?? p?.podcast?.podcastID;
            if (id != null) set.add(String(id));
        });
        return set;
    }, [favoritePodcasts]);

    const togglePodcastFavorite = useCallback(
        async (podcastID, isFavorite) => {
            if (!token) return { success: false, message: "Brak tokenu" };
            if (!podcastID) return { success: false, message: "Brak podcastID" };

            try {
                const res = await fetch(
                    `http://localhost:3000/api/podcasts/${podcastID}/${isFavorite ? "unfavorite" : "favorite"}`,
                    {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    return { success: false, message: data?.message || "Favorite update failed" };
                }

                await refetch();
                return { success: true };
            } catch (e) {
                return { success: false, message: e?.message || "Network error" };
            }
        },
        [token, refetch]
    );

    // -------- LIBRARY TOGGLES --------
    const toggleAlbumInLibrary = useCallback(
        async (albumID, isInLibrary) => {
            if (!token) return { success: false, message: "Brak tokenu" };
            if (!albumID) return { success: false, message: "Brak albumID" };

            try {
                const res = await fetch(`http://localhost:3000/api/albums/${albumID}/library`, {
                    method: isInLibrary ? "DELETE" : "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { success: false, message: data?.message || "Library update failed" };

                await refetch();
                return { success: true };
            } catch (e) {
                return { success: false, message: e?.message || "Network error" };
            }
        },
        [token, refetch]
    );

    const togglePlaylistInLibrary = useCallback(
        async (playlistID, isInLibrary) => {
            if (!token) return { success: false, message: "Brak tokenu" };
            if (!playlistID) return { success: false, message: "Brak playlistID" };

            try {
                const res = await fetch(`http://localhost:3000/api/playlists/${playlistID}/library`, {
                    method: isInLibrary ? "DELETE" : "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { success: false, message: data?.message || "Library update failed" };

                await refetch();
                return { success: true };
            } catch (e) {
                return { success: false, message: e?.message || "Network error" };
            }
        },
        [token, refetch]
    );

    // auto-fetch po zalogowaniu / reset po wylogowaniu
    useEffect(() => {
        if (!token) {
            reset();
            return;
        }
        refetch();
    }, [token, refetch, reset]);

    const value = useMemo(
        () => ({
            albums,
            playlists,

            favoriteSongs,
            likedSongIds,

            favoritePodcasts,
            favoritePodcastIds,

            loading,
            error,
            refetch,

            toggleSongLike,
            togglePodcastFavorite,
            toggleAlbumInLibrary,
            togglePlaylistInLibrary,
        }),
        [
            albums,
            playlists,
            favoriteSongs,
            likedSongIds,
            favoritePodcasts,
            favoritePodcastIds,
            loading,
            error,
            refetch,
            toggleSongLike,
            togglePodcastFavorite,
            toggleAlbumInLibrary,
            togglePlaylistInLibrary,
        ]
    );

    return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLibrary() {
    const ctx = useContext(LibraryContext);
    if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
    return ctx;
}
