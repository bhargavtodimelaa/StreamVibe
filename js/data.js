/* ============================================================
   StreamVibe - Sample catalogue data
   Shared by all pages (loaded first)

   All media URLs below were verified reachable (HTTP 206/200):
   - media.w3.org          progressive MP4
   - interactive-examples.mdn.mozilla.net (CC0 clips)
   - test-videos.co.uk     720p/108p test MP4s
   - samplelib.com / filesamples.com
   - Apple + Mux public HLS test streams (multi-bitrate)
   ============================================================ */

const CATEGORIES = ["Movies", "TV Shows", "Live", "Documentaries", "Kids"];

const CATALOGUE = [
  {
    id: "v1",
    title: "Big Buck Bunny",
    desc: "A giant rabbit takes gentle revenge on three bullying rodents in this charming animated short.",
    category: "Movies",
    genre: "Animation",
    rating: "PG",
    year: 2024,
    duration: "9:56",
    views: "12.4M",
    thumb: "https://picsum.photos/seed/bunny/640/360",
    src: "https://media.w3.org/2010/05/bunny/movie.mp4",
    trending: true,
    isNew: false,
    featured: true
  },
  {
    id: "v2",
    title: "Elephant's Dream",
    desc: "Two characters explore a vast, surreal machine-world in the world's first open movie.",
    category: "Movies",
    genre: "Sci-Fi",
    rating: "PG",
    year: 2023,
    duration: "1:00",
    views: "8.1M",
    thumb: "https://picsum.photos/seed/elephantdream/640/360",
    src: "https://filesamples.com/samples/video/mp4/sample_1280x720.mp4",
    trending: false,
    isNew: false,
    featured: true
  },
  {
    id: "v3",
    title: "Sintel",
    desc: "A lonely girl searches the world for the dragon she once rescued, in this fantasy epic.",
    category: "Movies",
    genre: "Fantasy",
    rating: "PG-13",
    year: 2025,
    duration: "0:52",
    views: "15.9M",
    thumb: "https://picsum.photos/seed/sintel/640/360",
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    trending: true,
    isNew: true,
    featured: true
  },
  {
    id: "v4",
    title: "Tears of Steel",
    desc: "Scientists in a future Amsterdam try to rewrite a love story that doomed the world.",
    category: "Movies",
    genre: "Sci-Fi",
    rating: "PG-13",
    year: 2024,
    duration: "0:45",
    views: "6.7M",
    thumb: "https://picsum.photos/seed/tearssteel/640/360",
    src: "https://media.w3.org/2010/05/video/movie_300.mp4",
    trending: false,
    isNew: false,
    featured: false
  },
  {
    id: "v5",
    title: "For Bigger Blazes",
    desc: "Action-packed episode: fire, adrenaline and a race against time.",
    category: "TV Shows",
    genre: "Action",
    rating: "PG-13",
    year: 2025,
    duration: "0:15",
    views: "3.2M",
    thumb: "https://picsum.photos/seed/blazes/640/360",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    trending: true,
    isNew: true,
    featured: false
  },
  {
    id: "v6",
    title: "For Bigger Escapes",
    desc: "Episode 2 of the hit series — nobody escapes unscathed.",
    category: "TV Shows",
    genre: "Thriller",
    rating: "PG-13",
    year: 2025,
    duration: "0:15",
    views: "2.8M",
    thumb: "https://picsum.photos/seed/escapes/640/360",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    trending: false,
    isNew: true,
    featured: false
  },
  {
    id: "v7",
    title: "For Bigger Fun",
    desc: "The comedy special everyone is talking about.",
    category: "TV Shows",
    genre: "Comedy",
    rating: "G",
    year: 2024,
    duration: "0:15",
    views: "5.5M",
    thumb: "https://picsum.photos/seed/biggerfun/640/360",
    src: "https://samplelib.com/lib/preview/mp4/sample-15s.mp4",
    trending: false,
    isNew: false,
    featured: false
  },
  {
    id: "v8",
    title: "Live: World Finals",
    desc: "The championship match, streaming live with multi-angle coverage.",
    category: "Live",
    genre: "Sports",
    rating: "G",
    year: 2026,
    duration: "LIVE",
    views: "1.2M watching",
    thumb: "https://picsum.photos/seed/livefinals/640/360",
    src: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8",
    hls: true,
    isLive: true,
    trending: true,
    isNew: true,
    featured: true
  },
  {
    id: "v9",
    title: "Live: Music Festival Stage B",
    desc: "Non-stop performances from the main stage. Tune in anytime.",
    category: "Live",
    genre: "Music",
    rating: "G",
    year: 2026,
    duration: "LIVE",
    views: "480K watching",
    thumb: "https://picsum.photos/seed/livemusic/640/360",
    src: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    hls: true,
    isLive: true,
    trending: false,
    isNew: true,
    featured: false
  },
  {
    id: "v10",
    title: "Deep Ocean",
    desc: "A documentary journey to the darkest trenches of the Pacific.",
    category: "Documentaries",
    genre: "Nature",
    rating: "G",
    year: 2024,
    duration: "0:10",
    views: "9.3M",
    thumb: "https://picsum.photos/seed/deepocean/640/360",
    src: "https://test-videos.co.uk/vids/jellyfish/mp4/h264/1080/Jellyfish_1080_10s_5MB.mp4",
    trending: true,
    isNew: false,
    featured: true
  },
  {
    id: "v11",
    title: "Machines That Changed Us",
    desc: "How engineering shaped the modern world, told through the people who built it.",
    category: "Documentaries",
    genre: "History",
    rating: "PG",
    year: 2023,
    duration: "1:00",
    views: "4.1M",
    thumb: "https://picsum.photos/seed/machines/640/360",
    src: "https://filesamples.com/samples/video/mp4/sample_640x360.mp4",
    trending: false,
    isNew: false,
    featured: false
  },
  {
    id: "v12",
    title: "Wild Rivers",
    desc: "Following the world's great rivers from source to sea.",
    category: "Documentaries",
    genre: "Nature",
    rating: "G",
    year: 2025,
    duration: "0:30",
    views: "7.7M",
    thumb: "https://picsum.photos/seed/wildrivers/640/360",
    src: "https://samplelib.com/lib/preview/mp4/sample-30s.mp4",
    trending: false,
    isNew: true,
    featured: false
  },
  {
    id: "v13",
    title: "The Little Explorer",
    desc: "A bright, friendly cartoon for the smallest viewers.",
    category: "Kids",
    genre: "Animation",
    rating: "G",
    year: 2025,
    duration: "0:10",
    views: "11.2M",
    thumb: "https://picsum.photos/seed/littleexplorer/640/360",
    src: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_5MB.mp4",
    trending: true,
    isNew: false,
    featured: false
  },
  {
    id: "v14",
    title: "Puppy Adventures",
    desc: "Four puppies, one backyard, endless fun. Safe for all ages.",
    category: "Kids",
    genre: "Family",
    rating: "G",
    year: 2024,
    duration: "0:05",
    views: "6.9M",
    thumb: "https://picsum.photos/seed/puppies/640/360",
    src: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
    trending: false,
    isNew: false,
    featured: false
  },
  {
    id: "v15",
    title: "Midnight City",
    desc: "A detective story set in a city that never sleeps. Contains mature themes.",
    category: "Movies",
    genre: "Crime",
    rating: "R",
    year: 2026,
    duration: "0:20",
    views: "10.5M",
    thumb: "https://picsum.photos/seed/midnightcity/640/360",
    src: "https://samplelib.com/lib/preview/mp4/sample-20s.mp4",
    trending: true,
    isNew: true,
    featured: false
  },
  {
    id: "v16",
    title: "Grand Tour",
    desc: "Three presenters, one budget, and a continent to cross.",
    category: "TV Shows",
    genre: "Reality",
    rating: "PG",
    year: 2024,
    duration: "0:10",
    views: "5.0M",
    thumb: "https://picsum.photos/seed/grandtour/640/360",
    src: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_5MB.mp4",
    trending: false,
    isNew: false,
    featured: false
  }
];

// Default subscription plans (admin can toggle them)
const DEFAULT_PLANS = [
  { id: "basic", name: "Basic", price: "$4.99/mo", active: true, subscribers: 18420 },
  { id: "standard", name: "Standard", price: "$9.99/mo", active: true, subscribers: 32110 },
  { id: "premium", name: "Premium", price: "$14.99/mo", active: true, subscribers: 12905 }
];

const USERS = [
  { name: "Aarav Sharma", email: "aarav@example.com", plan: "Premium", status: "Active", joined: "2025-04-12" },
  { name: "Sofia Mendes", email: "sofia@example.com", plan: "Standard", status: "Active", joined: "2025-07-03" },
  { name: "Ken Watanabe", email: "ken@example.com", plan: "Basic", status: "Trial", joined: "2026-01-19" },
  { name: "Lena Fischer", email: "lena@example.com", plan: "Premium", status: "Active", joined: "2024-11-27" },
  { name: "Omar Haddad", email: "omar@example.com", plan: "Standard", status: "Past due", joined: "2025-09-08" },
  { name: "Priya Nair", email: "priya@example.com", plan: "Basic", status: "Active", joined: "2026-02-14" }
];
