require('dotenv').config();

const client_id = process.env.Spotify_clientId;
const client_secret = process.env.Spotify_client_secret;

async function auth(){
    const url = 'https://accounts.spotify.com/api/token'
    const authOptions = {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    };
    const response = await fetch(url,authOptions);
    const data = await response.json();

    if (data.access_token) {
        return data.access_token;
    }
    else{
        return null
    }
}

async function Spotify_search(arg){
    const token = await auth()
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(arg)}&type=track`
    const requestOptions = {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }
    const response = await fetch(url,requestOptions)
    const data = await response.json();
    if (data.tracks.items.length > 0) {
        const track = data.tracks.items[0];
        const trackUrl = track.external_urls.spotify;
        return { name: track.name, url: trackUrl }
    }
    else {
        return null
    }
}

async function Spotify_Playlist(playlist_ID) {
    const token = await auth();
    console.log(token);

    let offset = 0;
    let name = [];
    let urls = [];

    while (true) {
        const url = `https://api.spotify.com/v1/playlists/${playlist_ID}/tracks?offset=${offset}&locale=ja`;
        const requestOptions = {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        };

        const response = await fetch(url, requestOptions);
        const data = await response.json();

        for (const item of data.items) {
            name.push(item.track.name);
            urls.push(item.track.external_urls.spotify);
        }

        offset += 100;
        if (offset >= data.total) {
            break;
        }
    }
    console.log(name.size)
    return { name, urls };
}

module.exports = { Spotify_search, Spotify_Playlist }