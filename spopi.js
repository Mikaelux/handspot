require('dotenv').config()
const express = require('express')
const axios = require('axios')
const cors = require('cors')
const querystring = require('querystring')

var app = express()
app.use(cors())
app.use(express.json())

client_id = process.env.CLIENT_ID
client_secret = process.env.CLIENT_SECRET
redirect_uri = process.env.REDIRECT_URI

app.listen(8080, ()=>{
    console.log('listening on port 8080')
})
let tracks = []
let access_token = null;
app.get('/login', (req, res)=>{
    var scope = "playlist-read-private user-read-email user-modify-playback-state user-read-playback-state";
    res.redirect("https://accounts.spotify.com/authorize?"+
                querystring.stringify({
                    response_type:"code",
                    client_id:client_id,
                    redirect_uri:redirect_uri,
                    scope:scope
                }));
})

let usedCodes = new Set();
app.get('/callback', async function (req, res){
  try{
        const code = req.query.code
        if (usedCodes.has(code)) return res.redirect('http://localhost:5173');
        usedCodes.add(code);
        const tokenR = await axios.post(
            'https://accounts.spotify.com/api/token',
            querystring.stringify({
                    code: code,
                    redirect_uri: redirect_uri,
                    grant_type: 'authorization_code'
            }),
            {headers:{
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
                }
            }
        );

        access_token = tokenR.data.access_token;

        const playlist_data= await axios.get("https://api.spotify.com/v1/playlists/63ckJNkWRVaUdlpWzWIhx2/items",
            {
                headers: { Authorization: "Bearer " + access_token }
            });
        const playlist_tracks = playlist_data.data;

        tracks = playlist_tracks.items.map(item =>{
            const track = item.track;
            return {
                title: track.name,
                artist: track.artists.map(a=> a.name).join(','),
                cover:track.album.images[0]?.url,
                uri:track.uri
            }
        });
       res.redirect('http://localhost:5173');
      }catch(err){
        console.error('Callback error:', err.response?.data || err.message);
        res.status(500).send('Auth failed');
      }
});

 app.get('/api/songs', (req, res)=>{
            res.json(tracks)
        })

app.put('/api/play', async (req, res) => {
  try {
    const deviceRes = await axios.get( 'https://api.spotify.com/v1/me/player/devices', 
        {headers: { Authorization: 'Bearer ' + access_token}}
    );
    const devices = deviceRes.data.devices;
    const devicePick = '0eb64ad3009c63d5b6a0491dec6c61c2f89cd388'
    if (!devicePick) return res.status(404).json({ error: 'No active device' });
    await axios.put('https://api.spotify.com/v1/me/player',
      { device_ids: [devicePick], play: false },
      { headers: { Authorization: 'Bearer ' + access_token } }
    );
    await new Promise(r => setTimeout(r, 500));
    const { uri } = req.body;
    await axios.put(
      'https://api.spotify.com/v1/me/player/play',
      { uris: [uri], device_id: devicePick.id},
      { headers: { Authorization: 'Bearer ' + access_token } }
    );
    res.sendStatus(204);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: err.message });
  }
});

app.put('/api/volume', async(req, res) =>{
    try{
        const { volume_percent } = req.query;
        await axios.put(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volume_percent}`,
            {},
            {headers: {Authorization: 'Bearer ' + access_token}}
        );
        res.sendStatus(204);
    }
    catch(err){
        console.error(err.response?.data || err.message);
        res.status(500).json(err.response?.data || { error: err.message });
    }
});
