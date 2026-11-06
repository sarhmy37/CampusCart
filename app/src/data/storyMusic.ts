export type StoryMusicTrack = {
  key: string;
  title: string;
  artist: string;
  uri: string;
  durationMs: number;
  avatar?: string | null;
};

// Temporary demo tracks. Replace these URLs with Tre-X-cleared audio later.
export const STORY_MUSIC: StoryMusicTrack[] = [
  {
    key: 'demo-1',
    title: 'SoundHelix Song 1',
    artist: 'Demo Library',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    durationMs: 180000,
    avatar: null,
  },
  {
    key: 'demo-2',
    title: 'SoundHelix Song 2',
    artist: 'Demo Library',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    durationMs: 180000,
    avatar: null,
  },
];
