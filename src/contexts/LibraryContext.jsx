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
import { deleteFolder as apiDeleteFolder } from "../api/library/folders.api.js";

const LibraryContext = createContext(null);

function pickRoleName(user) {
    return user?.role?.roleName || user?.roleName || user?.role || "";
}

function normalizePlaylist(p) {
    if (!p) return null;

    return {
        playlistID: p?.playlistID ?? p?.id ?? null,
        playlistName: p?.playlistName ?? p?.name ?? "Playlista",
        signedCover: p?.signedCover || null,
        coverURL: p?.coverURL || null,

        creatorName: p?.creatorName || p?.user?.userName || null,
        user: p?.user ? { userID: p.user.userID, userName: p.user.userName } : null,

        visibility: p?.visibility ?? null,
        moderationStatus: p?.moderationStatus ?? null,

        createdAt: p?.createdAt ?? null,
        addedAt: p?.addedAt ?? null,
    };
}

function normalizeFavSongRow(row) {
    if (!row) return null;

    const s = row?.song || row;

    if (!s) return null;

    return {
        addedAt: row?.addedAt ?? s?.addedAt ?? null,

        songID: s?.songID ?? s?.id ?? null,
        songName: s?.songName ?? s?.title ?? "Utwór",
        duration: s?.duration ?? null,

        creatorName: s?.creatorName || s?.creator?.user?.userName || null,

        signedAudio: s?.signedAudio || null,
        signedCover: s?.signedCover || null,
        effectiveCover: s?.effectiveCover || s?.signedCover || s?.album?.signedCover || null,

        album: s?.album
            ? {
                albumID: s.album.albumID,
                albumName: s.album.albumName,
                signedCover: s.album.signedCover || null,
            }
            : null,
    };
}

function normalizeFavPodcastRow(row) {
    if (!row) return null;

    const p = row?.podcast || row;
    if (!p) return null;

    return {
        addedAt: row?.addedAt ?? p?.addedAt ?? null,

        podcastID: p?.podcastID ?? p?.id ?? null,
        title: p?.title ?? p?.podcastName ?? "Podcast",
        duration: p?.duration ?? null,

        creatorName: p?.creatorName || p?.creator?.user?.userName || null,

        signedAudio: p?.signedAudio || null,
        signedCover: p?.signedCover || null,
    };
}

function normalizeAlbum(a) {
    return {
        albumID: a?.albumID ?? a?.id ?? null,
        albumName: a?.albumName ?? a?.name ?? "Album",
        signedCover: a?.signedCover || a?.albumSignedCover || a?.coverSigned || null,
        creatorName: a?.creatorName || a?.creator?.user?.userName || null,
        createdAt: a?.createdAt || null,
        _source: a?._source || "unknown",
    };
}

function mergeAlbumsUnique(primary = [], extra = []) {
    const map = new Map();
    [...primary, ...extra].forEach((x) => {
        const n = normalizeAlbum(x);
        if (!n.albumID) return;
        map.set(String(n.albumID), n);
    });
    return Array.from(map.values());
}

export function LibraryProvider({ children }) {
    const { token, user } = useAuth();
    const isCreatorRole = pickRoleName(user) === "Creator";

    const [folders, setFolders] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [favoriteSongs, setFavoriteSongs] = useState([]);
    const [favoritePodcasts, setFavoritePodcasts] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const abortRef = useRef(null);

    const reset = useCallback(() => {
        setFolders([]);
        setAlbums([]);
        setPlaylists([]);
        setFavoriteSongs([]);
        setFavoritePodcasts([]);
        setLoading(false);
        setError("");
    }, []);

    const removeFolderLocal = useCallback((folderID) => {
        if (folderID == null) return;
        setFolders((prev) => (prev || []).filter((f) => String(f.folderID) !== String(folderID)));
    }, []);

    const addFolderLocal = useCallback((folder) => {
        if (!folder?.folderID) return;
        setFolders((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            const exists = list.some((f) => String(f.folderID) === String(folder.folderID));
            if (exists) return list;
            return [
                {
                    folderID: folder.folderID,
                    folderName: folder.folderName || "Folder",
                    userID: folder.userID,
                    createdAt: folder.createdAt,
                },
                ...list,
            ];
        });
    }, []);

    const refetch = useCallback(async () => {
        if (!token) return;

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
            const requests = [
                fetch("http://localhost:3000/api/folders", {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                }),
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
            ];

            if (isCreatorRole) {
                requests.push(
                    fetch("http://localhost:3000/api/creators/me", {
                        headers: { Authorization: `Bearer ${token}` },
                        signal: ac.signal,
                    })
                );
            }

            const resArr = await Promise.all(requests);

            const foldersRes = resArr[0];
            const likedRes = resArr[1];
            const favPodsRes = resArr[2];
            const albumsRes = resArr[3];
            const playlistsRes = resArr[4];
            const myCreatorRes = isCreatorRole ? resArr[5] : null;

            const likedData = await likedRes.json().catch(() => ({}));
            const favPodsData = await favPodsRes.json().catch(() => ({}));
            const albumsData = await albumsRes.json().catch(() => ({}));
            const playlistsData = await playlistsRes.json().catch(() => ({}));
            const foldersData = await foldersRes.json().catch(() => ({}));
            const myCreatorData = myCreatorRes ? await myCreatorRes.json().catch(() => ({})) : null;

            if (!likedRes.ok) throw new Error(likedData?.message || "Failed to fetch liked songs");
            if (!favPodsRes.ok) throw new Error(favPodsData?.message || "Failed to fetch favorite podcasts");
            if (!albumsRes.ok) throw new Error(albumsData?.message || "Failed to fetch library albums");
            if (!playlistsRes.ok) throw new Error(playlistsData?.message || "Failed to fetch library playlists");
            if (!foldersRes.ok) throw new Error(foldersData?.message || "Failed to fetch folders");

            let creatorOk = true;
            if (myCreatorRes && !myCreatorRes.ok) {
                if (myCreatorRes.status === 403) creatorOk = false;
                else throw new Error(myCreatorData?.message || "Failed to fetch creator profile");
            }

            // LIKED SONGS
            const likedRaw = Array.isArray(likedData) ? likedData : likedData?.songs || [];
            const likedNorm = (likedRaw || []).map(normalizeFavSongRow).filter((x) => x?.songID != null);
            setFavoriteSongs(likedNorm);

            // FAVORITE PODCASTS
            const podsRaw = Array.isArray(favPodsData) ? favPodsData : favPodsData?.podcasts || [];
            const podsNorm = (podsRaw || []).map(normalizeFavPodcastRow).filter((x) => x?.podcastID != null);
            setFavoritePodcasts(podsNorm);

            // PLAYLISTS
            const playlistsRaw = Array.isArray(playlistsData) ? playlistsData : playlistsData?.playlists || [];
            const playlistsNorm = (playlistsRaw || []).map(normalizePlaylist).filter((p) => p?.playlistID != null);
            setPlaylists(playlistsNorm);

            // FOLDERS
            const foldersNorm = (Array.isArray(foldersData) ? foldersData : [])
                .filter(Boolean)
                .map((f) => ({
                    folderID: f.folderID,
                    folderName: f.folderName || "Folder",
                    userID: f.userID,
                    createdAt: f.createdAt,
                }));
            setFolders(foldersNorm);

            // ALBUMS (merge library + creator albums)
            const libraryAlbumsRaw = Array.isArray(albumsData) ? albumsData : albumsData?.albums || [];
            const creatorAlbumsRaw = creatorOk ? myCreatorData?.albums || [] : [];

            const libraryAlbums = (libraryAlbumsRaw || []).filter(Boolean).map((a) => ({ ...a, _source: "library" }));
            const creatorAlbums = (creatorAlbumsRaw || []).filter(Boolean).map((a) => ({ ...a, _source: "creator" }));

            const mergedAlbums = isCreatorRole && creatorOk ? mergeAlbumsUnique(libraryAlbums, creatorAlbums) : libraryAlbums;
            setAlbums(mergedAlbums);
        } catch (e) {
            if (e?.name === "AbortError") return;

            setError(e?.message || "Library error");

            // By nie zostawały stare dane po błędzie
            setFolders([]);
            setAlbums([]);
            setPlaylists([]);
            setFavoriteSongs([]);
            setFavoritePodcasts([]);
        } finally {
            setLoading(false);
        }
    }, [token, isCreatorRole]);

    // NEW: delete folder via api helper + local state update
    const deleteFolder = useCallback(
        async (folderID, opts = { refetchAfter: false }) => {
            if (!token) return { success: false, message: "Brak tokenu" };
            if (!folderID) return { success: false, message: "Brak folderID" };

            try {
                await apiDeleteFolder(token, folderID);

                // sidebar aktualizuje się natychmiast
                removeFolderLocal(folderID);

                if (opts?.refetchAfter) {
                    await refetch();
                }

                return { success: true };
            } catch (e) {
                return { success: false, message: e?.message || "Nie udało się usunąć folderu" };
            }
        },
        [token, removeFolderLocal, refetch]
    );

    // LIKED SONGS
    const toggleSongLike = useCallback(
        async (songID, isLiked) => {
            if (!token) return { success: false, message: "Brak tokenu" };
            if (!songID) return { success: false, message: "Brak songID" };

            try {
                const res = await fetch(`http://localhost:3000/api/songs/${songID}/${isLiked ? "unlike" : "like"}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });

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

    // FAVORITE PODCASTS / "MOJE ODCINKI"
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
                if (!res.ok) return { success: false, message: data?.message || "Favorite update failed" };

                await refetch();
                return { success: true };
            } catch (e) {
                return { success: false, message: e?.message || "Network error" };
            }
        },
        [token, refetch]
    );

    // LIBRARY TOGGLES
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
            folders,
            setFolders,
            removeFolderLocal,
            addFolderLocal,
            deleteFolder,

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
            folders,
            removeFolderLocal,
            addFolderLocal,
            deleteFolder,
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
