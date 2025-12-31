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
            const [albumsRes, playlistsRes, libRes] = await Promise.all([
                fetch("http://localhost:3000/api/libraries/albums", {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                }),
                fetch("http://localhost:3000/api/libraries/playlists/list", {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                }),
                fetch("http://localhost:3000/api/libraries", {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                }),
            ]);

            const albumsData = await albumsRes.json().catch(() => ({}));
            const playlistsData = await playlistsRes.json().catch(() => ({}));
            const libData = await libRes.json().catch(() => ({}));

            if (!albumsRes.ok) {
                throw new Error(albumsData?.message || "Failed to fetch library albums");
            }
            if (!playlistsRes.ok) {
                throw new Error(playlistsData?.message || "Failed to fetch library playlists");
            }
            if (!libRes.ok) {
                throw new Error(libData?.message || "Failed to fetch library");
            }

            setAlbums(Array.isArray(albumsData) ? albumsData : albumsData.albums || []);
            setPlaylists(
                Array.isArray(playlistsData) ? playlistsData : playlistsData.playlists || []
            );
            setFavoriteSongs(libData.favoriteSongs || []);
            setFavoritePodcasts(libData.favoritePodcasts || []);
        } catch (e) {
            if (e?.name === "AbortError") return;
            setError(e?.message || "Library error");
        } finally {
            setLoading(false);
        }
    }, [token]);

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
            favoritePodcasts,
            loading,
            error,
            refetch,
            toggleAlbumInLibrary,
            togglePlaylistInLibrary,
        }),
        [
            albums,
            playlists,
            favoriteSongs,
            favoritePodcasts,
            loading,
            error,
            refetch,
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
