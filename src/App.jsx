import { useState, useEffect, useRef } from 'react'
import scriptjs from 'scriptjs'
import './App.css'

const trackers = ['wss://tracker.openwebtorrent.com'];
const webTorrentVersion = '1.3.4';

function App() {
  const fileInputRef = useRef();

  const [loaded, setLoaded] = useState(false)
  const [inputEnabled, setInputEnabled] = useState(false);
  const [logs, setLogs] = useState([]);
  const [client, setClient] = useState({});
  const [magnetLink, setMagnetLink] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadCompleted, setDownloadCompleted] = useState(false);
  const [dLSpeed, setDLSpeed] = useState(0);
  const [dLProgress, setDLProgress] = useState(0);
  const [fileLinks, setFileLinks] = useState([]);


  useEffect(() => {
    scriptjs([
      `https://cdn.jsdelivr.net/npm/webtorrent@${webTorrentVersion}/webtorrent.min.js`,
    ], () => {
      setLoaded(true);
      addLogs('Loaded WebTorrent');
    });
  }, [])

  useEffect(() => {
    if (loaded) {
      setClient(new WebTorrent({
        tracker: {
          rtcConfig: {
            iceServers: [
              {
                urls: [
                  'stun:stun.l.google.com:19302',
                  'stun:global.stun.twilio.com:3478'
                ]
              },
            ],
            sdpSemantics: 'unified-plan',
            bundlePolicy: 'max-bundle',
            iceCandidatePoolsize: 1
          },
        },
        maxConns: 50,
        dht: false,
        lsd: false,
      }));
      setInputEnabled(true);
      addLogs('Created WebTorrent client');
    }
  }, [loaded]);


  useEffect(() => {
    if (!client) {
      return;
    }

    const handleFiles = (ev) => {
      const fileList = ev.target.files;
      if (!fileList) {
        return;
      }
      console.log('going to seed', fileList);

      addLogs('Generating magnet link...');
      client.seed(fileList, { announce: trackers }, function (torrent) {
        console.log('Client is seeding ' + torrent.magnetURI);

        navigator.clipboard.writeText(torrent.magnetURI);

        addLogs([
          'The magnet link was copied to clipboard!',
          `Magnet link: ${torrent.magnetURI}`,
        ]);
      });

      setInputEnabled(false);
    }
    fileInputRef.current.addEventListener('change', handleFiles);

    return () => { fileInputRef.current.removeEventListener('change', handleFiles) }
  }, [client, fileInputRef])

  const addLogs = (newLogs) => {
    if (!Array.isArray(newLogs)) {
      newLogs = [newLogs];
    }
    const newList = [...logs, ...newLogs];
    setLogs(newList);
  }

  const startDownload = () => {
    if (!magnetLink) {
      return;
    }
    addLogs('Got magnet link...');

    setInputEnabled(false);
    setDownloading(true);
    const startTime = new Date();

    let downloadStartTime = null;
    const handleTorrentDone = (torrent) => {
      let updatesCounter = 0;
      torrent.on('download', () => {
        if (!downloadStartTime) {
          downloadStartTime = new Date();
        }

        const newDLSpeed = (torrent.downloadSpeed / 1024 / 1024).toFixed(2);
        const newDLProgress = (torrent.progress * 100).toFixed(1);
        if (updatesCounter % 2000 === 0) {
          setDLSpeed(newDLSpeed);
          setDLProgress(newDLProgress)
        }
        updatesCounter += 1;
      });

      torrent.on('done', () => {
        setDownloading(false);
        setDownloadCompleted(true);
        const endTime = new Date();
        const totTime = ((endTime - startTime) / 1000).toFixed(3);
        const idleTime = ((downloadStartTime - startTime) / 1000).toFixed(3);
        const transferTime = ((endTime - downloadStartTime) / 1000).toFixed(3);
        addLogs(`DL complete. TOT time: ${totTime}s - Transfer: ${transferTime}s - Idle: ${idleTime}s`)

        let fileLinks = [];
        torrent.files.forEach(f => {
          f.getBlobURL((err, url) => {
            if (err) {
              console.error(err);
              return;
            }

            fileLinks.push({
              download: f.name,
              href: url,
              textContent: `Download ${f.name}`
            })
          })
        });
        setFileLinks(fileLinks);
      });

      torrent.on('error', (err) => {
        console.error(err);
        setDownloading(false);
        setInputEnabled(true);
        setMagnetLink('');
      });
    };

    client.add(magnetLink, {}, handleTorrentDone);

    client.on('error', (err) => {
      console.error(err);
      setDownloading(false);
      setInputEnabled(true);
      setMagnetLink('');
      addLogs(`Error: ${err.message}`);
    });
  }

  return (
    <div className="App">
      <header className="App-header">
        <p>Webtorrent client (v{webTorrentVersion})</p>
      </header>

      <div className='container'>
        <div className='magnet-link'>
          <h4>Insert magnet link:</h4>
          <input
            type='text'
            disabled={!inputEnabled}
            value={magnetLink}
            onChange={(e) => setMagnetLink(e.target.value)}
          />
          <button
            id='start-download'
            onClick={startDownload}
            disabled={!magnetLink || !inputEnabled}
          >
            Start download
          </button>
        </div>
        {client && downloading && (
          <>
            <p>Download speed: {dLSpeed} MB/s</p>
            <p>Progress: {dLProgress}%</p>
          </>
        )}
        {downloadCompleted && (
          <ul>
            {fileLinks.map(({href, download, textContent}) => {
              return (
                <li>
                  <a href={href} download={download}>{textContent}</a>
                </li>
              )
            })}
          </ul>
        )}
        <br />
        <h4>...or select files to seed:</h4>
        <br />
        <input type="file" multiple ref={fileInputRef} disabled={!inputEnabled} />

        <br />

        <h4>Logs:</h4>
        <ul>
          {logs.map((log, idx) => {
            return <li key={idx}>{log}</li>
          })}
        </ul>
      </div>
    </div>
  )
}

export default App
