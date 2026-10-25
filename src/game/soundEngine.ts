/**
 * Upgraded 16-Bit Arcade Multi-Stadium Procedural Audio Engine
 * (Web Audio API + Tone.js integration) with 10 bespoke stadium soundtracks.
 */

import type { PitchThemeId } from './graphicsConfig';
import type { PokieMachineId } from './rules';

declare global {
  interface Window {
    Tone?: {
      start: () => Promise<void>;
    };
    webkitAudioContext?: typeof AudioContext;
  }
}

export interface StadiumMusicProfile {
  id: PitchThemeId;
  title: string;
  bpm: number;
  leadWave: OscillatorType;
  harmonyWave: OscillatorType;
  bassWave: OscillatorType;
  leadCutoff: number;
  bassCutoff: number;
  chordCutoff: number;
  leadDecay: number;
  percStyle: 'CLASSIC' | 'FOLK_SHUFFLE' | 'SAKURA_WOOD' | 'STADIUM_MARCH' | 'SPACE_ELECTRO' | 'BOOM_BAP' | 'SAMBA_AGOGO' | 'SYNTHWAVE' | 'ICE_CHIME' | 'FORGE_ANVIL';
  melodySectionA: number[];
  melodySectionB: number[];
  melodySectionC: number[];
  melodySectionD: number[];
  harmonyNotes: number[];
  bassNotesA: number[];
  bassNotesB: number[];
  chordVoicings: number[][];
  arpNotes: number[];
  goalChimeNotes: number[];
}

export const STADIUM_MUSIC_PROFILES: Record<PitchThemeId, StadiumMusicProfile> = {
  CLASSIC_TURF: {
    id: 'CLASSIC_TURF',
    title: 'Sunlit Botanical Samba-Funk',
    bpm: 124,
    leadWave: 'triangle',
    harmonyWave: 'sine',
    bassWave: 'triangle',
    leadCutoff: 1450,
    bassCutoff: 520,
    chordCutoff: 1280,
    leadDecay: 0.21,
    percStyle: 'CLASSIC',
    melodySectionA: [
      523.25, 0, 659.25, 0, 783.99, 0, 659.25, 523.25,
      0, 587.33, 0, 659.25, 523.25, 0, 440.0, 0,
      523.25, 0, 659.25, 783.99, 880.0, 0, 783.99, 659.25,
      587.33, 0, 523.25, 0, 440.0, 0, 0, 0,
    ],
    melodySectionB: [
      659.25, 0, 783.99, 0, 880.0, 0, 783.99, 659.25,
      587.33, 0, 659.25, 0, 783.99, 0, 587.33, 0,
      523.25, 0, 659.25, 0, 880.0, 0, 783.99, 659.25,
      587.33, 523.25, 440.0, 0, 523.25, 0, 0, 0,
    ],
    melodySectionC: [
      0, 0, 783.99, 0, 659.25, 0, 523.25, 0,
      0, 0, 587.33, 0, 523.25, 0, 440.0, 0,
      0, 0, 880.0, 0, 783.99, 0, 659.25, 0,
      587.33, 0, 523.25, 0, 440.0, 0, 0, 0,
    ],
    melodySectionD: [
      880.0, 0, 783.99, 659.25, 523.25, 0, 659.25, 0,
      587.33, 0, 659.25, 783.99, 659.25, 0, 523.25, 0,
      880.0, 0, 1046.5, 0, 880.0, 783.99, 659.25, 0,
      587.33, 0, 523.25, 0, 659.25, 0, 0, 0,
    ],
    harmonyNotes: [
      392.0, 0, 523.25, 0, 587.33, 0, 523.25, 392.0,
      0, 440.0, 0, 523.25, 392.0, 0, 329.63, 0,
      392.0, 0, 523.25, 587.33, 659.25, 0, 587.33, 523.25,
      440.0, 0, 392.0, 0, 329.63, 0, 0, 0,
    ],
    bassNotesA: [
      87.31, 0, 87.31, 174.61, 0, 87.31, 130.81, 0,
      82.41, 0, 82.41, 164.81, 0, 82.41, 123.47, 0,
      73.42, 0, 73.42, 146.83, 0, 73.42, 110.0, 0,
      98.0, 0, 98.0, 196.0, 0, 110.0, 123.47, 130.81,
    ],
    bassNotesB: [
      87.31, 0, 130.81, 174.61, 0, 87.31, 0, 130.81,
      82.41, 0, 123.47, 164.81, 0, 82.41, 0, 123.47,
      73.42, 0, 110.0, 146.83, 0, 73.42, 0, 110.0,
      98.0, 0, 146.83, 196.0, 0, 123.47, 130.81, 146.83,
    ],
    chordVoicings: [
      [174.61, 220.0, 261.63, 329.63, 392.0],
      [164.81, 196.0, 246.94, 293.66, 392.0],
      [146.83, 220.0, 261.63, 329.63, 392.0],
      [196.0, 246.94, 293.66, 349.23, 440.0],
    ],
    arpNotes: [523.25, 659.25, 783.99, 1046.5, 1318.51, 1046.5, 783.99, 659.25],
    goalChimeNotes: [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98],
  },

  TURF_AUTUMN: {
    id: 'TURF_AUTUMN',
    title: 'Golden Maple Folk-Funk Groove',
    bpm: 118,
    leadWave: 'sine',
    harmonyWave: 'triangle',
    bassWave: 'triangle',
    leadCutoff: 1320,
    bassCutoff: 480,
    chordCutoff: 1120,
    leadDecay: 0.19,
    percStyle: 'FOLK_SHUFFLE',
    // Warm D-Major / B-Minor pentatonic wooden marimba hook
    melodySectionA: [
      587.33, 0, 659.25, 739.99, 880.0, 0, 739.99, 587.33,
      0, 493.88, 587.33, 0, 659.25, 0, 493.88, 0,
      587.33, 0, 739.99, 880.0, 987.77, 0, 880.0, 739.99,
      659.25, 0, 587.33, 493.88, 440.0, 0, 0, 0,
    ],
    melodySectionB: [
      739.99, 0, 880.0, 0, 987.77, 880.0, 739.99, 659.25,
      587.33, 0, 659.25, 739.99, 659.25, 0, 493.88, 0,
      587.33, 659.25, 739.99, 0, 880.0, 0, 739.99, 587.33,
      659.25, 587.33, 493.88, 0, 587.33, 0, 0, 0,
    ],
    melodySectionC: [
      0, 587.33, 0, 739.99, 0, 659.25, 493.88, 0,
      0, 440.0, 0, 587.33, 0, 493.88, 369.99, 0,
      0, 739.99, 0, 880.0, 0, 739.99, 659.25, 0,
      587.33, 0, 493.88, 0, 440.0, 0, 0, 0,
    ],
    melodySectionD: [
      987.77, 0, 880.0, 739.99, 587.33, 0, 739.99, 0,
      659.25, 0, 739.99, 880.0, 739.99, 0, 587.33, 0,
      987.77, 0, 1174.66, 0, 987.77, 880.0, 739.99, 0,
      659.25, 0, 587.33, 0, 739.99, 0, 0, 0,
    ],
    harmonyNotes: [
      440.0, 0, 493.88, 587.33, 659.25, 0, 587.33, 440.0,
      0, 369.99, 440.0, 0, 493.88, 0, 369.99, 0,
      440.0, 0, 587.33, 659.25, 739.99, 0, 659.25, 587.33,
      493.88, 0, 440.0, 369.99, 329.63, 0, 0, 0,
    ],
    bassNotesA: [
      73.42, 0, 110.0, 146.83, 0, 110.0, 98.0, 0,
      61.74, 0, 92.5, 123.47, 0, 92.5, 110.0, 0,
      82.41, 0, 123.47, 164.81, 0, 123.47, 110.0, 0,
      110.0, 0, 110.0, 164.81, 0, 123.47, 146.83, 164.81,
    ],
    bassNotesB: [
      73.42, 92.5, 110.0, 146.83, 0, 110.0, 0, 146.83,
      61.74, 82.41, 92.5, 123.47, 0, 92.5, 0, 123.47,
      82.41, 98.0, 123.47, 164.81, 0, 123.47, 0, 164.81,
      110.0, 0, 138.59, 164.81, 0, 146.83, 138.59, 110.0,
    ],
    chordVoicings: [
      [146.83, 185.0, 220.0, 277.18, 329.63], // Dmaj9
      [123.47, 185.0, 220.0, 293.66, 369.99], // Bm7
      [164.81, 196.0, 246.94, 293.66, 369.99], // Em9
      [110.0, 164.81, 196.0, 277.18, 329.63], // A13
    ],
    arpNotes: [587.33, 739.99, 880.0, 1174.66, 1479.98, 1174.66, 880.0, 739.99],
    goalChimeNotes: [587.33, 739.99, 880.0, 1174.66, 1479.98, 1760.0],
  },

  TURF_SAKURA: {
    id: 'TURF_SAKURA',
    title: 'Kyoto Blossom City-Pop & Koto',
    bpm: 122,
    leadWave: 'triangle',
    harmonyWave: 'sine',
    bassWave: 'triangle',
    leadCutoff: 1950,
    bassCutoff: 560,
    chordCutoff: 1420,
    leadDecay: 0.16,
    percStyle: 'SAKURA_WOOD',
    // Japanese Hirajoshi / Gmaj7 City-Pop plucked koto melody (E, F#, G, B, C, D)
    melodySectionA: [
      659.25, 739.99, 783.99, 0, 987.77, 0, 783.99, 739.99,
      659.25, 0, 493.88, 0, 587.33, 659.25, 0, 0,
      659.25, 739.99, 783.99, 987.77, 1046.5, 0, 987.77, 783.99,
      739.99, 0, 659.25, 0, 493.88, 0, 0, 0,
    ],
    melodySectionB: [
      987.77, 0, 1046.5, 987.77, 783.99, 0, 739.99, 659.25,
      587.33, 0, 659.25, 739.99, 783.99, 0, 659.25, 0,
      783.99, 0, 987.77, 0, 1174.66, 0, 987.77, 783.99,
      739.99, 659.25, 587.33, 0, 659.25, 0, 0, 0,
    ],
    melodySectionC: [
      0, 0, 987.77, 0, 783.99, 739.99, 659.25, 0,
      0, 0, 739.99, 0, 659.25, 587.33, 493.88, 0,
      0, 0, 1046.5, 0, 987.77, 783.99, 739.99, 0,
      659.25, 0, 587.33, 0, 493.88, 0, 0, 0,
    ],
    melodySectionD: [
      1174.66, 0, 987.77, 783.99, 659.25, 0, 783.99, 987.77,
      1046.5, 987.77, 783.99, 739.99, 659.25, 0, 493.88, 0,
      1174.66, 0, 1318.51, 0, 1174.66, 987.77, 783.99, 0,
      739.99, 0, 659.25, 0, 783.99, 0, 0, 0,
    ],
    harmonyNotes: [
      493.88, 0, 587.33, 0, 659.25, 0, 587.33, 493.88,
      440.0, 0, 392.0, 0, 440.0, 493.88, 0, 0,
      493.88, 0, 587.33, 659.25, 783.99, 0, 659.25, 587.33,
      493.88, 0, 440.0, 0, 392.0, 0, 0, 0,
    ],
    bassNotesA: [
      98.0, 0, 98.0, 196.0, 0, 98.0, 146.83, 0,
      92.5, 0, 92.5, 185.0, 0, 92.5, 138.59, 0,
      82.41, 0, 82.41, 164.81, 0, 82.41, 123.47, 0,
      110.0, 0, 110.0, 220.0, 0, 123.47, 146.83, 164.81,
    ],
    bassNotesB: [
      98.0, 0, 146.83, 196.0, 0, 146.83, 98.0, 0,
      92.5, 0, 138.59, 185.0, 0, 138.59, 92.5, 0,
      82.41, 0, 123.47, 164.81, 0, 123.47, 82.41, 0,
      110.0, 0, 164.81, 220.0, 0, 146.83, 164.81, 185.0,
    ],
    chordVoicings: [
      [196.0, 246.94, 293.66, 369.99, 440.0], // Gmaj9
      [185.0, 220.0, 277.18, 329.63, 440.0], // F#m7
      [164.81, 196.0, 246.94, 293.66, 392.0], // Em9
      [110.0, 164.81, 220.0, 277.18, 329.63], // A9
    ],
    arpNotes: [659.25, 739.99, 783.99, 987.77, 1318.51, 987.77, 783.99, 739.99],
    goalChimeNotes: [659.25, 739.99, 783.99, 987.77, 1174.66, 1567.98],
  },

  TURF_CHAMPIONS: {
    id: 'TURF_CHAMPIONS',
    title: 'Champions Cathedral Brass Anthem',
    bpm: 128,
    leadWave: 'sawtooth',
    harmonyWave: 'triangle',
    bassWave: 'triangle',
    leadCutoff: 1580,
    bassCutoff: 580,
    chordCutoff: 1380,
    leadDecay: 0.24,
    percStyle: 'STADIUM_MARCH',
    // Uplifting Stadium Brass Fanfare in C Major / A Minor
    melodySectionA: [
      523.25, 0, 783.99, 0, 1046.5, 0, 987.77, 783.99,
      880.0, 0, 659.25, 0, 783.99, 0, 523.25, 0,
      698.46, 0, 880.0, 1046.5, 1174.66, 0, 1046.5, 880.0,
      783.99, 0, 659.25, 587.33, 783.99, 0, 0, 0,
    ],
    melodySectionB: [
      1046.5, 0, 987.77, 880.0, 783.99, 0, 659.25, 523.25,
      698.46, 0, 783.99, 880.0, 783.99, 0, 587.33, 0,
      1046.5, 0, 1174.66, 1318.51, 1046.5, 0, 880.0, 783.99,
      880.0, 783.99, 659.25, 587.33, 523.25, 0, 0, 0,
    ],
    melodySectionC: [
      0, 523.25, 659.25, 783.99, 0, 880.0, 783.99, 0,
      0, 440.0, 523.25, 659.25, 0, 783.99, 659.25, 0,
      0, 587.33, 698.46, 880.0, 0, 1046.5, 880.0, 0,
      783.99, 0, 659.25, 0, 587.33, 0, 0, 0,
    ],
    melodySectionD: [
      1046.5, 0, 1318.51, 0, 1174.66, 1046.5, 880.0, 783.99,
      880.0, 0, 1046.5, 0, 987.77, 880.0, 783.99, 0,
      1046.5, 0, 1318.51, 1567.98, 1318.51, 1174.66, 1046.5, 0,
      987.77, 0, 880.0, 783.99, 1046.5, 0, 0, 0,
    ],
    harmonyNotes: [
      392.0, 0, 523.25, 0, 659.25, 0, 587.33, 523.25,
      523.25, 0, 440.0, 0, 523.25, 0, 392.0, 0,
      440.0, 0, 587.33, 659.25, 698.46, 0, 659.25, 587.33,
      523.25, 0, 440.0, 392.0, 523.25, 0, 0, 0,
    ],
    bassNotesA: [
      65.41, 130.81, 65.41, 130.81, 65.41, 130.81, 98.0, 130.81,
      110.0, 220.0, 110.0, 220.0, 110.0, 220.0, 98.0, 110.0,
      87.31, 174.61, 87.31, 174.61, 87.31, 174.61, 110.0, 130.81,
      98.0, 196.0, 98.0, 196.0, 110.0, 123.47, 130.81, 146.83,
    ],
    bassNotesB: [
      65.41, 0, 130.81, 196.0, 65.41, 130.81, 0, 130.81,
      110.0, 0, 164.81, 220.0, 110.0, 164.81, 0, 164.81,
      87.31, 0, 130.81, 174.61, 87.31, 130.81, 0, 174.61,
      98.0, 0, 146.83, 196.0, 110.0, 123.47, 146.83, 196.0,
    ],
    chordVoicings: [
      [130.81, 196.0, 246.94, 293.66, 329.63], // Cmaj9
      [110.0, 164.81, 196.0, 246.94, 329.63], // Am9
      [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
      [196.0, 261.63, 293.66, 349.23, 440.0], // G11
    ],
    arpNotes: [523.25, 783.99, 1046.5, 1318.51, 1567.98, 1318.51, 1046.5, 783.99],
    goalChimeNotes: [523.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0],
  },

  COSMIC_SPACE: {
    id: 'COSMIC_SPACE',
    title: 'Zero-G Galactic Synth Odyssey',
    bpm: 120,
    leadWave: 'sine',
    harmonyWave: 'triangle',
    bassWave: 'sine',
    leadCutoff: 2150,
    bassCutoff: 440,
    chordCutoff: 1650,
    leadDecay: 0.25,
    percStyle: 'SPACE_ELECTRO',
    // Lydian Sci-Fi Starfield Melody (F, G, A, B, C, E)
    melodySectionA: [
      659.25, 0, 783.99, 987.77, 0, 880.0, 783.99, 0,
      587.33, 0, 659.25, 783.99, 0, 493.88, 0, 0,
      659.25, 0, 987.77, 1174.66, 0, 1046.5, 987.77, 783.99,
      659.25, 0, 587.33, 493.88, 659.25, 0, 0, 0,
    ],
    melodySectionB: [
      987.77, 0, 1046.5, 0, 1174.66, 987.77, 880.0, 783.99,
      659.25, 0, 783.99, 0, 987.77, 783.99, 659.25, 0,
      1046.5, 0, 1174.66, 0, 1318.51, 1174.66, 987.77, 783.99,
      880.0, 783.99, 659.25, 0, 587.33, 0, 0, 0,
    ],
    melodySectionC: [
      1318.51, 0, 987.77, 0, 783.99, 0, 659.25, 0,
      1174.66, 0, 880.0, 0, 659.25, 0, 493.88, 0,
      1318.51, 0, 1046.5, 0, 987.77, 0, 783.99, 0,
      659.25, 0, 587.33, 0, 493.88, 0, 0, 0,
    ],
    melodySectionD: [
      1174.66, 0, 987.77, 1046.5, 1318.51, 0, 987.77, 783.99,
      880.0, 0, 987.77, 783.99, 659.25, 0, 587.33, 0,
      1318.51, 0, 1567.98, 0, 1318.51, 1174.66, 987.77, 0,
      880.0, 0, 783.99, 0, 659.25, 0, 0, 0,
    ],
    harmonyNotes: [
      493.88, 0, 587.33, 659.25, 0, 587.33, 493.88, 0,
      392.0, 0, 440.0, 523.25, 0, 392.0, 0, 0,
      493.88, 0, 659.25, 783.99, 0, 783.99, 659.25, 587.33,
      493.88, 0, 440.0, 392.0, 493.88, 0, 0, 0,
    ],
    bassNotesA: [
      87.31, 0, 174.61, 0, 87.31, 0, 174.61, 130.81,
      82.41, 0, 164.81, 0, 82.41, 0, 164.81, 123.47,
      73.42, 0, 146.83, 0, 73.42, 0, 146.83, 110.0,
      65.41, 0, 130.81, 0, 98.0, 0, 123.47, 130.81,
    ],
    bassNotesB: [
      87.31, 174.61, 0, 174.61, 87.31, 0, 130.81, 174.61,
      82.41, 164.81, 0, 164.81, 82.41, 0, 123.47, 164.81,
      73.42, 146.83, 0, 146.83, 73.42, 0, 110.0, 146.83,
      65.41, 130.81, 0, 130.81, 98.0, 110.0, 123.47, 146.83,
    ],
    chordVoicings: [
      [174.61, 246.94, 261.63, 329.63, 392.0], // Fmaj7#11
      [164.81, 196.0, 246.94, 293.66, 392.0], // Em7
      [146.83, 207.65, 220.0, 277.18, 329.63], // Dmaj7#11
      [130.81, 196.0, 246.94, 293.66, 392.0], // Cmaj9
    ],
    arpNotes: [659.25, 987.77, 1174.66, 1318.51, 1567.98, 1318.51, 1174.66, 987.77],
    goalChimeNotes: [659.25, 987.77, 1174.66, 1318.51, 1567.98, 1975.53],
  },

  URBAN_CONCRETE: {
    id: 'URBAN_CONCRETE',
    title: 'Rooftop Block-Party Boom-Bap Funk',
    bpm: 112,
    leadWave: 'square',
    harmonyWave: 'triangle',
    bassWave: 'triangle',
    leadCutoff: 1180,
    bassCutoff: 490,
    chordCutoff: 1050,
    leadDecay: 0.17,
    percStyle: 'BOOM_BAP',
    // G-Dorian Street Funk Clavinet Riff (G, Bb, C, D, E, F)
    melodySectionA: [
      392.0, 0, 466.16, 523.25, 587.33, 0, 523.25, 466.16,
      392.0, 0, 0, 349.23, 392.0, 0, 466.16, 0,
      392.0, 0, 466.16, 523.25, 659.25, 587.33, 523.25, 466.16,
      587.33, 0, 523.25, 466.16, 392.0, 0, 0, 0,
    ],
    melodySectionB: [
      587.33, 0, 698.46, 587.33, 523.25, 0, 466.16, 392.0,
      466.16, 0, 523.25, 587.33, 523.25, 0, 392.0, 0,
      587.33, 0, 698.46, 783.99, 698.46, 587.33, 523.25, 466.16,
      523.25, 466.16, 392.0, 349.23, 392.0, 0, 0, 0,
    ],
    melodySectionC: [
      0, 392.0, 0, 466.16, 523.25, 0, 392.0, 0,
      0, 349.23, 0, 466.16, 523.25, 0, 349.23, 0,
      0, 392.0, 0, 587.33, 659.25, 0, 587.33, 0,
      523.25, 0, 466.16, 0, 392.0, 0, 0, 0,
    ],
    melodySectionD: [
      783.99, 0, 698.46, 587.33, 523.25, 466.16, 392.0, 0,
      466.16, 523.25, 587.33, 0, 659.25, 587.33, 523.25, 0,
      783.99, 0, 932.33, 783.99, 698.46, 587.33, 523.25, 0,
      466.16, 0, 392.0, 349.23, 392.0, 0, 0, 0,
    ],
    harmonyNotes: [
      293.66, 0, 349.23, 392.0, 440.0, 0, 392.0, 349.23,
      293.66, 0, 0, 261.63, 293.66, 0, 349.23, 0,
      293.66, 0, 349.23, 392.0, 493.88, 440.0, 392.0, 349.23,
      440.0, 0, 392.0, 349.23, 293.66, 0, 0, 0,
    ],
    bassNotesA: [
      98.0, 0, 98.0, 0, 116.54, 130.81, 146.83, 0,
      65.41, 0, 65.41, 0, 98.0, 116.54, 130.81, 0,
      77.78, 0, 77.78, 0, 116.54, 146.83, 155.56, 0,
      73.42, 0, 73.42, 146.83, 0, 116.54, 98.0, 87.31,
    ],
    bassNotesB: [
      98.0, 98.0, 0, 146.83, 0, 130.81, 116.54, 98.0,
      65.41, 65.41, 0, 130.81, 0, 116.54, 98.0, 65.41,
      77.78, 77.78, 0, 155.56, 0, 146.83, 116.54, 77.78,
      73.42, 0, 110.0, 146.83, 0, 130.81, 116.54, 98.0,
    ],
    chordVoicings: [
      [196.0, 233.08, 293.66, 349.23, 440.0], // Gm9
      [130.81, 196.0, 233.08, 293.66, 329.63], // C9
      [155.56, 196.0, 233.08, 293.66, 349.23], // Ebmaj9
      [146.83, 185.0, 233.08, 261.63, 349.23], // D7#9
    ],
    arpNotes: [392.0, 466.16, 587.33, 698.46, 783.99, 698.46, 587.33, 466.16],
    goalChimeNotes: [392.0, 466.16, 587.33, 698.46, 783.99, 1174.66],
  },

  RIO_CLAY: {
    id: 'RIO_CLAY',
    title: 'Copacabana Beach Batucada & Steel Drum',
    bpm: 130,
    leadWave: 'triangle',
    harmonyWave: 'sine',
    bassWave: 'triangle',
    leadCutoff: 1750,
    bassCutoff: 540,
    chordCutoff: 1360,
    leadDecay: 0.18,
    percStyle: 'SAMBA_AGOGO',
    // Sunny Brazilian A6/9 Samba-Batucada Hook (A, B, C#, E, F#, G#)
    melodySectionA: [
      440.0, 554.37, 659.25, 0, 739.99, 659.25, 554.37, 0,
      493.88, 554.37, 659.25, 0, 554.37, 493.88, 440.0, 0,
      440.0, 554.37, 659.25, 739.99, 880.0, 0, 739.99, 659.25,
      554.37, 0, 493.88, 440.0, 554.37, 0, 0, 0,
    ],
    melodySectionB: [
      659.25, 0, 739.99, 880.0, 0, 739.99, 659.25, 554.37,
      493.88, 0, 554.37, 659.25, 0, 554.37, 493.88, 0,
      659.25, 739.99, 880.0, 0, 987.77, 880.0, 739.99, 659.25,
      554.37, 493.88, 440.0, 0, 440.0, 0, 0, 0,
    ],
    melodySectionC: [
      0, 659.25, 0, 554.37, 440.0, 0, 554.37, 0,
      0, 554.37, 0, 493.88, 369.99, 0, 493.88, 0,
      0, 739.99, 0, 659.25, 554.37, 0, 659.25, 0,
      493.88, 0, 440.0, 0, 369.99, 0, 0, 0,
    ],
    melodySectionD: [
      880.0, 0, 739.99, 659.25, 554.37, 0, 659.25, 739.99,
      880.0, 739.99, 659.25, 554.37, 493.88, 0, 440.0, 0,
      880.0, 0, 1108.73, 987.77, 880.0, 739.99, 659.25, 0,
      554.37, 0, 493.88, 440.0, 659.25, 0, 0, 0,
    ],
    harmonyNotes: [
      329.63, 440.0, 554.37, 0, 554.37, 493.88, 440.0, 0,
      369.99, 440.0, 493.88, 0, 440.0, 369.99, 329.63, 0,
      329.63, 440.0, 554.37, 587.33, 659.25, 0, 587.33, 554.37,
      440.0, 0, 369.99, 329.63, 440.0, 0, 0, 0,
    ],
    // Partido-Alto Syncopated Samba Bass
    bassNotesA: [
      110.0, 0, 0, 164.81, 110.0, 0, 164.81, 0,
      92.5, 0, 0, 138.59, 92.5, 0, 138.59, 0,
      123.47, 0, 0, 185.0, 123.47, 0, 185.0, 0,
      82.41, 0, 123.47, 164.81, 82.41, 92.5, 98.0, 103.83,
    ],
    bassNotesB: [
      110.0, 0, 164.81, 220.0, 0, 164.81, 110.0, 0,
      92.5, 0, 138.59, 185.0, 0, 138.59, 92.5, 0,
      123.47, 0, 185.0, 246.94, 0, 185.0, 123.47, 0,
      82.41, 0, 123.47, 164.81, 0, 110.0, 123.47, 138.59,
    ],
    chordVoicings: [
      [110.0, 164.81, 220.0, 277.18, 369.99], // A6/9
      [185.0, 220.0, 277.18, 329.63, 415.3], // F#m9
      [123.47, 185.0, 220.0, 277.18, 369.99], // Bm9
      [164.81, 207.65, 246.94, 293.66, 369.99], // E13
    ],
    arpNotes: [554.37, 659.25, 739.99, 880.0, 1108.73, 880.0, 739.99, 659.25],
    goalChimeNotes: [440.0, 554.37, 659.25, 739.99, 880.0, 1318.51],
  },

  TWILIGHT_SYNTH: {
    id: 'TWILIGHT_SYNTH',
    title: 'Cyber-Metropolis Outrun Synthwave',
    bpm: 134,
    leadWave: 'sawtooth',
    harmonyWave: 'triangle',
    bassWave: 'sawtooth',
    leadCutoff: 1820,
    bassCutoff: 620,
    chordCutoff: 1450,
    leadDecay: 0.22,
    percStyle: 'SYNTHWAVE',
    // A-Minor Outrun Synthwave Lead Hook (A, B, C, D, E, G)
    melodySectionA: [
      440.0, 0, 523.25, 659.25, 587.33, 0, 523.25, 493.88,
      440.0, 0, 392.0, 0, 440.0, 523.25, 659.25, 0,
      440.0, 0, 523.25, 659.25, 783.99, 0, 659.25, 587.33,
      523.25, 0, 493.88, 440.0, 392.0, 0, 0, 0,
    ],
    melodySectionB: [
      659.25, 0, 783.99, 880.0, 783.99, 659.25, 587.33, 523.25,
      493.88, 0, 523.25, 587.33, 659.25, 0, 440.0, 0,
      659.25, 0, 783.99, 880.0, 1046.5, 0, 880.0, 783.99,
      659.25, 587.33, 523.25, 493.88, 440.0, 0, 0, 0,
    ],
    melodySectionC: [
      880.0, 659.25, 523.25, 440.0, 880.0, 659.25, 523.25, 440.0,
      783.99, 587.33, 493.88, 392.0, 783.99, 587.33, 493.88, 392.0,
      698.46, 523.25, 440.0, 349.23, 698.46, 523.25, 440.0, 349.23,
      659.25, 0, 587.33, 0, 493.88, 0, 0, 0,
    ],
    melodySectionD: [
      880.0, 0, 1046.5, 880.0, 783.99, 0, 659.25, 523.25,
      587.33, 0, 659.25, 783.99, 659.25, 0, 440.0, 0,
      880.0, 0, 1046.5, 1318.51, 1174.66, 1046.5, 880.0, 0,
      783.99, 0, 659.25, 587.33, 440.0, 0, 0, 0,
    ],
    harmonyNotes: [
      329.63, 0, 392.0, 440.0, 392.0, 0, 349.23, 329.63,
      293.66, 0, 261.63, 0, 329.63, 392.0, 440.0, 0,
      329.63, 0, 392.0, 440.0, 523.25, 0, 440.0, 392.0,
      349.23, 0, 329.63, 293.66, 261.63, 0, 0, 0,
    ],
    // Rolling 16th-note Synthwave Octave Bassline
    bassNotesA: [
      110.0, 220.0, 110.0, 220.0, 110.0, 220.0, 110.0, 220.0,
      87.31, 174.61, 87.31, 174.61, 87.31, 174.61, 87.31, 174.61,
      65.41, 130.81, 65.41, 130.81, 65.41, 130.81, 65.41, 130.81,
      82.41, 164.81, 82.41, 164.81, 98.0, 196.0, 110.0, 123.47,
    ],
    bassNotesB: [
      110.0, 110.0, 220.0, 110.0, 110.0, 220.0, 164.81, 220.0,
      87.31, 87.31, 174.61, 87.31, 87.31, 174.61, 130.81, 174.61,
      65.41, 65.41, 130.81, 65.41, 65.41, 130.81, 98.0, 130.81,
      82.41, 82.41, 164.81, 82.41, 98.0, 110.0, 123.47, 164.81,
    ],
    chordVoicings: [
      [110.0, 164.81, 196.0, 246.94, 329.63], // Am9
      [87.31, 174.61, 220.0, 261.63, 329.63], // Fmaj7
      [130.81, 196.0, 246.94, 293.66, 329.63], // Cmaj9
      [82.41, 164.81, 220.0, 246.94, 329.63], // E7sus4
    ],
    arpNotes: [440.0, 523.25, 659.25, 880.0, 1046.5, 880.0, 659.25, 523.25],
    goalChimeNotes: [440.0, 523.25, 659.25, 880.0, 1046.5, 1318.51],
  },

  ARCTIC_ICE: {
    id: 'ARCTIC_ICE',
    title: 'Glacier Frost Aurora Chimes',
    bpm: 121,
    leadWave: 'sine',
    harmonyWave: 'triangle',
    bassWave: 'triangle',
    leadCutoff: 2450,
    bassCutoff: 460,
    chordCutoff: 1750,
    leadDecay: 0.22,
    percStyle: 'ICE_CHIME',
    // Sparkling Eb-Major9 / C-Minor9 Crystalline Glockenspiel Melody (Eb, F, G, Bb, C, D)
    melodySectionA: [
      622.25, 0, 783.99, 932.33, 1046.5, 0, 932.33, 783.99,
      698.46, 0, 783.99, 0, 622.25, 0, 587.33, 0,
      622.25, 0, 783.99, 932.33, 1174.66, 0, 1046.5, 932.33,
      783.99, 0, 698.46, 622.25, 587.33, 0, 0, 0,
    ],
    melodySectionB: [
      932.33, 0, 1046.5, 1174.66, 1244.51, 0, 1174.66, 932.33,
      783.99, 0, 932.33, 1046.5, 932.33, 0, 698.46, 0,
      932.33, 1046.5, 1174.66, 0, 1244.51, 1174.66, 932.33, 783.99,
      698.46, 622.25, 587.33, 0, 622.25, 0, 0, 0,
    ],
    melodySectionC: [
      1244.51, 0, 932.33, 0, 783.99, 0, 622.25, 0,
      1174.66, 0, 932.33, 0, 698.46, 0, 587.33, 0,
      1244.51, 0, 1046.5, 0, 932.33, 0, 783.99, 0,
      698.46, 0, 622.25, 0, 587.33, 0, 0, 0,
    ],
    melodySectionD: [
      1244.51, 0, 1174.66, 932.33, 783.99, 0, 932.33, 1046.5,
      1174.66, 0, 932.33, 783.99, 698.46, 0, 622.25, 0,
      1244.51, 0, 1567.98, 0, 1244.51, 1174.66, 932.33, 0,
      783.99, 0, 698.46, 622.25, 783.99, 0, 0, 0,
    ],
    harmonyNotes: [
      466.16, 0, 587.33, 622.25, 783.99, 0, 622.25, 587.33,
      523.25, 0, 587.33, 0, 466.16, 0, 440.0, 0,
      466.16, 0, 587.33, 622.25, 932.33, 0, 783.99, 622.25,
      587.33, 0, 523.25, 466.16, 440.0, 0, 0, 0,
    ],
    bassNotesA: [
      77.78, 0, 116.54, 155.56, 0, 116.54, 155.56, 0,
      65.41, 0, 98.0, 130.81, 0, 98.0, 130.81, 0,
      103.83, 0, 155.56, 207.65, 0, 155.56, 207.65, 0,
      116.54, 0, 116.54, 174.61, 0, 130.81, 146.83, 155.56,
    ],
    bassNotesB: [
      77.78, 0, 155.56, 0, 116.54, 155.56, 0, 116.54,
      65.41, 0, 130.81, 0, 98.0, 130.81, 0, 98.0,
      103.83, 0, 207.65, 0, 155.56, 207.65, 0, 155.56,
      116.54, 0, 174.61, 233.08, 0, 174.61, 146.83, 116.54,
    ],
    chordVoicings: [
      [155.56, 196.0, 233.08, 293.66, 349.23], // Ebmaj9
      [130.81, 196.0, 233.08, 293.66, 392.0], // Cm9
      [207.65, 261.63, 311.13, 392.0, 466.16], // Abmaj9
      [116.54, 174.61, 220.0, 261.63, 349.23], // Bb13
    ],
    arpNotes: [622.25, 783.99, 932.33, 1174.66, 1567.98, 1174.66, 932.33, 783.99],
    goalChimeNotes: [622.25, 783.99, 932.33, 1174.66, 1567.98, 1864.66],
  },

  VOLCANO_FORGE: {
    id: 'VOLCANO_FORGE',
    title: 'Magma Caldera Phrygian Forge Brass',
    bpm: 136,
    leadWave: 'sawtooth',
    harmonyWave: 'square',
    bassWave: 'sawtooth',
    leadCutoff: 1420,
    bassCutoff: 540,
    chordCutoff: 1180,
    leadDecay: 0.2,
    percStyle: 'FORGE_ANVIL',
    // E Phrygian-Dominant Boss Groove (E, F, G#, A, B, C, D)
    melodySectionA: [
      329.63, 349.23, 415.3, 0, 440.0, 415.3, 349.23, 329.63,
      0, 293.66, 329.63, 349.23, 329.63, 0, 246.94, 0,
      329.63, 349.23, 415.3, 440.0, 493.88, 0, 440.0, 415.3,
      349.23, 0, 329.63, 293.66, 329.63, 0, 0, 0,
    ],
    melodySectionB: [
      493.88, 0, 523.25, 493.88, 440.0, 415.3, 349.23, 329.63,
      349.23, 0, 415.3, 440.0, 493.88, 0, 329.63, 0,
      493.88, 0, 587.33, 523.25, 493.88, 440.0, 415.3, 349.23,
      415.3, 349.23, 329.63, 293.66, 329.63, 0, 0, 0,
    ],
    melodySectionC: [
      0, 329.63, 349.23, 0, 415.3, 0, 329.63, 0,
      0, 349.23, 440.0, 0, 523.25, 0, 349.23, 0,
      0, 293.66, 349.23, 0, 440.0, 0, 293.66, 0,
      246.94, 0, 293.66, 0, 329.63, 0, 0, 0,
    ],
    melodySectionD: [
      659.25, 0, 587.33, 523.25, 493.88, 440.0, 415.3, 349.23,
      415.3, 440.0, 493.88, 0, 415.3, 349.23, 329.63, 0,
      659.25, 0, 698.46, 659.25, 587.33, 523.25, 493.88, 415.3,
      440.0, 415.3, 349.23, 329.63, 329.63, 0, 0, 0,
    ],
    harmonyNotes: [
      246.94, 261.63, 329.63, 0, 349.23, 329.63, 261.63, 246.94,
      0, 220.0, 246.94, 261.63, 246.94, 0, 196.0, 0,
      246.94, 261.63, 329.63, 349.23, 392.0, 0, 349.23, 329.63,
      261.63, 0, 246.94, 220.0, 246.94, 0, 0, 0,
    ],
    bassNotesA: [
      82.41, 82.41, 164.81, 82.41, 0, 82.41, 87.31, 82.41,
      87.31, 87.31, 174.61, 87.31, 0, 87.31, 98.0, 87.31,
      73.42, 73.42, 146.83, 73.42, 0, 73.42, 87.31, 73.42,
      61.74, 61.74, 123.47, 61.74, 73.42, 82.41, 87.31, 98.0,
    ],
    bassNotesB: [
      82.41, 0, 82.41, 164.81, 87.31, 0, 82.41, 164.81,
      87.31, 0, 87.31, 174.61, 98.0, 0, 87.31, 174.61,
      73.42, 0, 73.42, 146.83, 87.31, 0, 73.42, 146.83,
      61.74, 0, 92.5, 123.47, 87.31, 82.41, 73.42, 61.74,
    ],
    chordVoicings: [
      [164.81, 207.65, 246.94, 293.66, 349.23], // E7(b9)
      [174.61, 220.0, 261.63, 329.63, 415.3], // FmMaj7 / Fmaj7#5
      [146.83, 220.0, 261.63, 293.66, 349.23], // Dm7
      [123.47, 185.0, 246.94, 293.66, 349.23], // B7(#9)
    ],
    arpNotes: [329.63, 349.23, 415.3, 493.88, 659.25, 493.88, 415.3, 349.23],
    goalChimeNotes: [329.63, 415.3, 493.88, 659.25, 830.61, 1318.51],
  },
};

export interface PokieSoundProfile {
  id: PokieMachineId;
  title: string;
  spinClunkStart: number;
  spinClunkEnd: number;
  spinWave: OscillatorType;
  spinNotes: number[];
  spinNoiseFreq: number;
  tickWave: OscillatorType;
  tickBaseFreq: number;
  tickReelStep: number;
  stopWave: OscillatorType;
  stopPitches: [number, number, number];
  stopPingMult: number;
  teaserNotes: number[];
  winWave: OscillatorType;
  winNotes: {
    SMALL: number[];
    BIG: number[];
    MEGA: number[];
    JACKPOT: number[];
  };
  holdSirenWave: OscillatorType;
  holdSirenStart: number;
  holdSirenEnd: number;
  holdTriggerNotes: number[];
  orbLockScale: number[];
}

export const POKIE_SOUND_PROFILES: Record<PokieMachineId, PokieSoundProfile> = {
  CHAMPIONS_GOLD: {
    id: 'CHAMPIONS_GOLD',
    title: 'Royal Stadium Brass & Marimba',
    spinClunkStart: 150,
    spinClunkEnd: 48,
    spinWave: 'triangle',
    spinNotes: [330, 440, 587.33, 783.99, 1046.5],
    spinNoiseFreq: 1950,
    tickWave: 'triangle',
    tickBaseFreq: 680,
    tickReelStep: 105,
    stopWave: 'triangle',
    stopPitches: [196.0, 246.94, 329.63],
    stopPingMult: 3.0,
    teaserNotes: [587.33, 783.99, 1046.5, 1318.5],
    winWave: 'triangle',
    winNotes: {
      SMALL: [523.25, 659.25, 783.99, 1046.5],
      BIG: [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98],
      MEGA: [523.25, 659.25, 783.99, 1046.5, 987.77, 1174.66, 1318.51, 1567.98, 2093.0],
      JACKPOT: [
        523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51, 1567.98,
        1318.51, 1567.98, 2093.0, 2637.02,
      ],
    },
    holdSirenWave: 'sawtooth',
    holdSirenStart: 320,
    holdSirenEnd: 960,
    holdTriggerNotes: [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0],
    orbLockScale: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98],
  },
  COSMIC_NEON: {
    id: 'COSMIC_NEON',
    title: 'Zero-G Cyber Laser & FM Synth',
    spinClunkStart: 420,
    spinClunkEnd: 110,
    spinWave: 'sine',
    spinNotes: [493.88, 659.25, 783.99, 987.77, 1318.51],
    spinNoiseFreq: 3400,
    tickWave: 'sine',
    tickBaseFreq: 1140,
    tickReelStep: 165,
    stopWave: 'sine',
    stopPitches: [293.66, 369.99, 493.88],
    stopPingMult: 3.6,
    teaserNotes: [659.25, 987.77, 1174.66, 1567.98],
    winWave: 'sine',
    winNotes: {
      SMALL: [659.25, 783.99, 987.77, 1318.51],
      BIG: [659.25, 783.99, 987.77, 1174.66, 1318.51, 1975.53],
      MEGA: [493.88, 659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98, 1975.53, 2637.02],
      JACKPOT: [
        659.25, 987.77, 1174.66, 1318.51, 987.77, 1318.51, 1567.98, 1975.53,
        1567.98, 1975.53, 2349.32, 2959.96,
      ],
    },
    holdSirenWave: 'sine',
    holdSirenStart: 480,
    holdSirenEnd: 1680,
    holdTriggerNotes: [659.25, 783.99, 987.77, 1174.66, 1318.51, 1975.53, 2637.02],
    orbLockScale: [659.25, 739.99, 783.99, 987.77, 1174.66, 1318.51, 1479.98, 1567.98, 1975.53],
  },
  VOLCANO_INFERNO: {
    id: 'VOLCANO_INFERNO',
    title: 'Molten Caldera Forge Anvil & Sub-Bass',
    spinClunkStart: 112,
    spinClunkEnd: 34,
    spinWave: 'sawtooth',
    spinNotes: [246.94, 329.63, 349.23, 415.3, 493.88],
    spinNoiseFreq: 1150,
    tickWave: 'square',
    tickBaseFreq: 460,
    tickReelStep: 75,
    stopWave: 'sawtooth',
    stopPitches: [130.81, 164.81, 207.65],
    stopPingMult: 2.5,
    teaserNotes: [329.63, 415.3, 493.88, 659.25],
    winWave: 'sawtooth',
    winNotes: {
      SMALL: [329.63, 415.3, 493.88, 659.25],
      BIG: [329.63, 349.23, 415.3, 493.88, 659.25, 830.61],
      MEGA: [329.63, 349.23, 415.3, 493.88, 523.25, 659.25, 830.61, 987.77, 1318.51],
      JACKPOT: [
        329.63, 415.3, 493.88, 659.25, 493.88, 659.25, 830.61, 987.77,
        830.61, 987.77, 1318.51, 1661.22,
      ],
    },
    holdSirenWave: 'sawtooth',
    holdSirenStart: 180,
    holdSirenEnd: 640,
    holdTriggerNotes: [329.63, 349.23, 415.3, 493.88, 659.25, 830.61, 1318.51],
    orbLockScale: [329.63, 349.23, 415.3, 440.0, 493.88, 523.25, 659.25, 830.61, 987.77],
  },
  HIGH_ROLLER_ROYAL: {
    id: 'HIGH_ROLLER_ROYAL',
    title: 'VIP 24K Bullion Vault & Crystal Harp',
    spinClunkStart: 220,
    spinClunkEnd: 68,
    spinWave: 'triangle',
    spinNotes: [622.25, 783.99, 932.33, 1174.66, 1567.98],
    spinNoiseFreq: 2800,
    tickWave: 'sine',
    tickBaseFreq: 1380,
    tickReelStep: 140,
    stopWave: 'triangle',
    stopPitches: [311.13, 392.0, 523.25],
    stopPingMult: 4.0,
    teaserNotes: [783.99, 932.33, 1174.66, 1567.98],
    winWave: 'triangle',
    winNotes: {
      SMALL: [622.25, 783.99, 932.33, 1244.51],
      BIG: [622.25, 783.99, 932.33, 1174.66, 1567.98, 1864.66],
      MEGA: [622.25, 783.99, 932.33, 1174.66, 1244.51, 1567.98, 1864.66, 2349.32, 2489.02],
      JACKPOT: [
        622.25, 783.99, 932.33, 1244.51, 932.33, 1244.51, 1567.98, 1864.66,
        1567.98, 1864.66, 2489.02, 3135.96,
      ],
    },
    holdSirenWave: 'triangle',
    holdSirenStart: 392,
    holdSirenEnd: 1244.51,
    holdTriggerNotes: [622.25, 783.99, 932.33, 1174.66, 1567.98, 1864.66, 2489.02],
    orbLockScale: [622.25, 698.46, 783.99, 932.33, 1046.5, 1174.66, 1244.51, 1567.98, 1864.66],
  },
};

export function getPokieSoundProfile(machineId: PokieMachineId): PokieSoundProfile {
  return POKIE_SOUND_PROFILES[machineId] || POKIE_SOUND_PROFILES.CHAMPIONS_GOLD;
}

export function getStadiumMusicProfile(themeId: PitchThemeId): StadiumMusicProfile {
  return STADIUM_MUSIC_PROFILES[themeId] || STADIUM_MUSIC_PROFILES.CLASSIC_TURF;
}

export class IndieSoundEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  noiseBuffer: AudioBuffer | null = null;
  crowdGain: GainNode | null = null;
  crowdFilter: BiquadFilterNode | null = null;
  muted = false;
  isPlayingMusic = false;
  stepIndex = 0;
  musicTimer: ReturnType<typeof setInterval> | null = null;
  toneReady = false;
  currentPitchTheme: PitchThemeId = 'CLASSIC_TURF';
  currentPokieMachine: PokieMachineId = 'CHAMPIONS_GOLD';
  getGameState: () => string;
  getFlowCombo: () => number;
  getPitchTheme: () => PitchThemeId;

  lastStepTime = 0;

  private iosUnlocked = false;
  private htmlAudioUnlockEl: HTMLAudioElement | null = null;
  private silentWavUrl: string | null = null;

  constructor(
    getGameState: () => string = () => 'PLAYING',
    getFlowCombo: () => number = () => 0,
    getPitchTheme: () => PitchThemeId = () => 'CLASSIC_TURF'
  ) {
    this.getGameState = getGameState;
    this.getFlowCombo = getFlowCombo;
    this.getPitchTheme = getPitchTheme;
  }

  setPitchTheme(themeId: PitchThemeId) {
    if (this.currentPitchTheme !== themeId) {
      this.currentPitchTheme = themeId;
      // Align step to start of bar so stadium theme switches feel immediately musical
      this.stepIndex = 0;
    }
  }

  setPokieMachine(machineId: PokieMachineId) {
    this.currentPokieMachine = machineId;
  }

  private getSilentWavUrl(): string {
    if (this.silentWavUrl) return this.silentWavUrl;
    try {
      const numSamples = 2000;
      const buffer = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buffer);
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 8000, true);
      view.setUint32(28, 8000, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true);
      writeString(36, 'data');
      view.setUint32(40, numSamples, true);
      for (let i = 0; i < numSamples; i++) {
        view.setUint8(44 + i, 128);
      }
      const blob = new Blob([buffer], { type: 'audio/wav' });
      this.silentWavUrl = URL.createObjectURL(blob);
      return this.silentWavUrl;
    } catch {
      return 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    }
  }

  init() {
    try {
      const navWithAudioSession = navigator as Navigator & {
        audioSession?: { type: string };
      };
      if (navWithAudioSession.audioSession) {
        try {
          navWithAudioSession.audioSession.type = 'playback';
        } catch {}
      }

      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-16, this.ctx.currentTime);
          comp.knee.setValueAtTime(12, this.ctx.currentTime);
          comp.ratio.setValueAtTime(3.2, this.ctx.currentTime);

          this.master = this.ctx.createGain();
          this.master.gain.setValueAtTime(this.muted ? 0 : 1.08, this.ctx.currentTime);
          this.master.connect(comp);
          comp.connect(this.ctx.destination);

          const sampleRate = this.ctx.sampleRate || 44100;
          this.noiseBuffer = this.ctx.createBuffer(1, sampleRate * 2.0, sampleRate);
          const data = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
          }

          const crowdSrc = this.ctx.createBufferSource();
          crowdSrc.buffer = this.noiseBuffer;
          crowdSrc.loop = true;

          this.crowdFilter = this.ctx.createBiquadFilter();
          this.crowdFilter.type = 'bandpass';
          this.crowdFilter.frequency.setValueAtTime(680, this.ctx.currentTime);
          this.crowdFilter.Q.setValueAtTime(1.4, this.ctx.currentTime);

          this.crowdGain = this.ctx.createGain();
          this.crowdGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

          crowdSrc.connect(this.crowdFilter);
          this.crowdFilter.connect(this.crowdGain);
          this.crowdGain.connect(this.master);
          crowdSrc.start(0);
        }
      }

      if (this.ctx) {
        const stateStr = this.ctx.state as string;
        if (stateStr !== 'running') {
          this.ctx.resume().catch(() => {});
        }
      }
    } catch {
      // Ignore Web Audio restriction errors
    }
  }

  unlock() {
    try {
      const navWithAudioSession = navigator as Navigator & {
        audioSession?: { type: string };
      };
      if (navWithAudioSession.audioSession) {
        try {
          navWithAudioSession.audioSession.type = 'playback';
        } catch {}
      }

      this.init();
      if (!this.ctx) return;

      const stateStr = this.ctx.state as string;
      if (stateStr !== 'running') {
        this.ctx.resume().catch(() => {});
      }

      if (!this.iosUnlocked || stateStr !== 'running') {
        try {
          const silentBuf = this.ctx.createBuffer(1, 1, 22050);
          const silentSrc = this.ctx.createBufferSource();
          silentSrc.buffer = silentBuf;
          silentSrc.connect(this.ctx.destination);
          silentSrc.start(0);
        } catch {}

        try {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          g.gain.value = 0.00001;
          osc.connect(g);
          g.connect(this.ctx.destination);
          osc.start(0);
          osc.stop(this.ctx.currentTime + 0.005);
        } catch {}

        try {
          if (!this.htmlAudioUnlockEl && typeof Audio !== 'undefined') {
            const a = new Audio(this.getSilentWavUrl());
            a.setAttribute('playsinline', 'true');
            a.setAttribute('webkit-playsinline', 'true');
            a.volume = 0.01;
            this.htmlAudioUnlockEl = a;
          }
          if (this.htmlAudioUnlockEl) {
            const p = this.htmlAudioUnlockEl.play();
            if (p && typeof p.then === 'function') {
              p.then(() => {
                this.iosUnlocked = true;
              }).catch(() => {});
            }
          }
        } catch {}

        if ((this.ctx.state as string) === 'running') {
          this.iosUnlocked = true;
        }
      }

      if (!this.isPlayingMusic) {
        this.startMusic();
      }
    } catch {}
  }

  ensureReady(): boolean {
    this.init();
    if (this.ctx) {
      const stateStr = this.ctx.state as string;
      if (stateStr === 'suspended' || stateStr === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }
    }
    return Boolean(!this.muted && this.ctx && this.master);
  }

  updateCrowdAmbience(excitement = 0, isPlaying = false) {
    if (!this.crowdGain || !this.crowdFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    const targetGain = !this.muted && isPlaying ? 0.022 + excitement * 0.1 : 0.001;
    const targetFreq = 620 + excitement * 580;
    this.crowdGain.gain.setTargetAtTime(targetGain, now, 0.18);
    this.crowdFilter.frequency.setTargetAtTime(targetFreq, now, 0.18);
  }

  toggleMute(): boolean {
    this.init();
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.muted ? 0 : 1.08, this.ctx.currentTime);
    }
    return this.muted;
  }

  playNoiseBurst(duration = 0.08, filterFreq = 1200, volume = 0.3, q = 1.0) {
    if (!this.ensureReady() || !this.noiseBuffer || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + duration + 0.015);
  }

  startMusic(
    stateGetter?: () => {
      gameState?: string;
      isPlaying?: boolean;
      isSuperFlow?: boolean;
      flowCombo: number;
      pitchTheme?: PitchThemeId;
    }
  ) {
    if (stateGetter) {
      this.getGameState = () => {
        const s = stateGetter();
        if (s.gameState) return s.gameState;
        return s.isPlaying ? 'PLAYING' : 'MENU';
      };
      this.getFlowCombo = () => stateGetter().flowCombo;
      this.getPitchTheme = () => stateGetter().pitchTheme || this.currentPitchTheme;
    }
    this.init();
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    const scheduleNextStep = () => {
      if (!this.isPlayingMusic) return;
      const st = this.getGameState ? this.getGameState() : 'PLAYING';
      if (this.getPitchTheme) {
        this.currentPitchTheme = this.getPitchTheme();
      }
      const isMenuGroove =
        this.isMenuMode ||
        st === 'MENU' ||
        st === 'SPLASH' ||
        st === 'MATCH_OVER';
      const activeBpm = isMenuGroove
        ? 120
        : getStadiumMusicProfile(this.currentPitchTheme).bpm || 124;
      const stepMs = Math.round(60000 / (activeBpm * 4));
      this.musicTimer = setTimeout(() => {
        if (this.isPlayingMusic && !this.muted && this.ctx) {
          const stateStr = this.ctx.state as string;
          if (stateStr !== 'running') {
            this.ctx.resume().catch(() => {});
          } else if (st === 'PAUSED') {
            this.updateCrowdAmbience(0, false);
          } else {
            this.playMusicStep(st);
          }
        }
        scheduleNextStep();
      }, stepMs) as unknown as ReturnType<typeof setInterval>;
    };
    scheduleNextStep();
  }

  stopMusic() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer as unknown as ReturnType<typeof setTimeout>);
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.isPlayingMusic = false;
  }

  isMenuMode = true;

  setMenuMode(isMenu: boolean) {
    this.isMenuMode = isMenu;
    if (isMenu) {
      this.updateCrowdAmbience(0, false);
    }
  }

  playMusicStep(currentState = 'PLAYING') {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    // Prevent step stacking if browser tab was backgrounded or timer jittered
    if (now - this.lastStepTime < 0.068) return;
    this.lastStepTime = now;

    const cycleStep = this.stepIndex % 128;
    const step = cycleStep % 32;
    const barStep = cycleStep % 16;
    const section = Math.floor(cycleStep / 32); // 0 = A, 1 = B, 2 = C (Pocket), 3 = D (Chorus)
    const isMenuGroove =
      this.isMenuMode ||
      currentState === 'MENU' ||
      currentState === 'SPLASH' ||
      currentState === 'MATCH_OVER';

    const profile = isMenuGroove
      ? STADIUM_MUSIC_PROFILES.CLASSIC_TURF
      : getStadiumMusicProfile(this.currentPitchTheme);

    const superFlow = !isMenuGroove && this.getFlowCombo() >= 3;
    const volScale = isMenuGroove ? 0.62 : 0.86;

    // 1. Stadium-Specific Kick Drum & Percussion Groove
    const isBoomBapKick = profile.percStyle === 'BOOM_BAP' && (barStep === 0 || barStep === 7 || barStep === 10);
    const isSambaKick = profile.percStyle === 'SAMBA_AGOGO' && (barStep % 4 === 0 || barStep % 4 === 3);
    const isStandardKick =
      profile.percStyle !== 'BOOM_BAP' &&
      profile.percStyle !== 'SAMBA_AGOGO' &&
      (barStep % 4 === 0 || (!isMenuGroove && barStep === 14 && section % 2 === 1));

    if (isBoomBapKick || isSambaKick || isStandardKick) {
      const kick = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      kick.type = 'sine';
      const startFreq = profile.percStyle === 'FORGE_ANVIL' ? 148 : profile.percStyle === 'BOOM_BAP' ? 124 : 134;
      kick.frequency.setValueAtTime(startFreq, now);
      kick.frequency.exponentialRampToValueAtTime(38, now + 0.115);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.185 * volScale, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.135);
      kick.connect(g);
      g.connect(this.master);
      kick.start(now);
      kick.stop(now + 0.145);
    }

    // 2. Stadium-Specific Chords / Warm Pads with Subtle Offbeat Comping
    if (barStep === 0 || barStep === 6 || (!isMenuGroove && (barStep === 10 || barStep === 12))) {
      const chordIdx = Math.floor(cycleStep / 16) % profile.chordVoicings.length;
      const chord = profile.chordVoicings[chordIdx];
      const holdDur = barStep === 0 ? 0.54 : barStep === 10 ? 0.18 : 0.28;
      const peakGain = (barStep === 0 ? 0.022 : barStep === 10 ? 0.011 : 0.015) * volScale;

      chord.forEach((freq, idx) => {
        if (!this.ctx || !this.master) return;
        const cOsc = this.ctx.createOscillator();
        const cFilter = this.ctx.createBiquadFilter();
        const cGain = this.ctx.createGain();
        cOsc.type = idx === 0 ? 'sine' : 'triangle';
        cOsc.detune.setValueAtTime((idx % 2 === 0 ? 1 : -1) * 2.5, now);
        cFilter.type = 'lowpass';
        cFilter.frequency.setValueAtTime(isMenuGroove ? 820 : profile.chordCutoff, now);
        cFilter.frequency.exponentialRampToValueAtTime(480, now + holdDur);
        cOsc.frequency.setValueAtTime(freq, now);
        cGain.gain.setValueAtTime(0.0001, now);
        cGain.gain.linearRampToValueAtTime(peakGain, now + 0.015);
        cGain.gain.exponentialRampToValueAtTime(0.0001, now + holdDur);
        cOsc.connect(cFilter);
        cFilter.connect(cGain);
        cGain.connect(this.master);
        cOsc.start(now);
        cOsc.stop(now + holdDur + 0.02);
      });
    }

    // 3. Stadium-Specific Bassline + Sub-Octave Warmth
    const activeBassPool = section >= 2 ? profile.bassNotesB : profile.bassNotesA;
    const bassFreq = activeBassPool[step % activeBassPool.length];
    if (bassFreq > 0) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = isMenuGroove ? 'triangle' : profile.bassWave;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isMenuGroove ? 340 : profile.bassCutoff, now);
      filter.frequency.exponentialRampToValueAtTime(155, now + 0.165);
      osc.frequency.setValueAtTime(bassFreq, now);
      const bassGain = profile.bassWave === 'sawtooth' ? 0.086 : 0.122;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(bassGain * volScale, now + 0.009);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.175);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.19);
    }

    // 4. Stadium-Specific Hi-Hats, Snares & Signature Auxiliary Percussion
    if (barStep % 2 === 0 || (profile.percStyle === 'FOLK_SHUFFLE' && barStep % 4 === 3)) {
      const hatFreq = profile.percStyle === 'ICE_CHIME' ? 9400 : profile.percStyle === 'SPACE_ELECTRO' ? 8600 : 7400;
      this.playNoiseBurst(0.022, hatFreq, (barStep % 4 === 2 ? 0.028 : 0.015) * volScale, 2.4);
    }
    if (barStep % 8 === 4 || (profile.percStyle === 'STADIUM_MARCH' && (barStep === 12 || barStep === 14 || barStep === 15))) {
      const snareDur = profile.percStyle === 'SYNTHWAVE' ? 0.098 : 0.066;
      const snareFreq = profile.percStyle === 'BOOM_BAP' ? 1550 : 1950;
      this.playNoiseBurst(snareDur, snareFreq, (isMenuGroove ? 0.04 : 0.076) * volScale, 1.5);
    }

    // Signature Stadium Percussion & Acoustic Flourishes
    if (!isMenuGroove) {
      if (profile.percStyle === 'SAMBA_AGOGO' && (barStep === 2 || barStep === 5 || barStep === 11 || barStep === 14)) {
        const agogo = this.ctx.createOscillator();
        const agG = this.ctx.createGain();
        agogo.type = 'triangle';
        agogo.frequency.setValueAtTime(barStep < 8 ? 880 : 1108.73, now);
        agG.gain.setValueAtTime(0.0001, now);
        agG.gain.linearRampToValueAtTime(0.025, now + 0.004);
        agG.gain.exponentialRampToValueAtTime(0.0001, now + 0.068);
        agogo.connect(agG);
        agG.connect(this.master);
        agogo.start(now);
        agogo.stop(now + 0.075);
      } else if (profile.percStyle === 'SAKURA_WOOD' && (barStep === 3 || barStep === 11 || barStep === 15)) {
        const wood = this.ctx.createOscillator();
        const wG = this.ctx.createGain();
        wood.type = 'sine';
        wood.frequency.setValueAtTime(barStep === 3 ? 987.77 : barStep === 11 ? 783.99 : 1174.66, now);
        wG.gain.setValueAtTime(0.0001, now);
        wG.gain.linearRampToValueAtTime(0.023, now + 0.003);
        wG.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        wood.connect(wG);
        wG.connect(this.master);
        wood.start(now);
        wood.stop(now + 0.056);
      } else if (profile.percStyle === 'FORGE_ANVIL' && (barStep === 6 || barStep === 12)) {
        const anvil = this.ctx.createOscillator();
        const aG = this.ctx.createGain();
        anvil.type = 'square';
        anvil.frequency.setValueAtTime(barStep === 12 ? 1318.51 : 987.77, now);
        anvil.frequency.exponentialRampToValueAtTime(659.25, now + 0.07);
        aG.gain.setValueAtTime(0.0001, now);
        aG.gain.linearRampToValueAtTime(0.021, now + 0.003);
        aG.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
        anvil.connect(aG);
        aG.connect(this.master);
        anvil.start(now);
        anvil.stop(now + 0.09);
      } else if (profile.percStyle === 'FOLK_SHUFFLE' && (barStep === 3 || barStep === 9)) {
        // Warm wooden marimba grace tap
        const mar = this.ctx.createOscillator();
        const mG = this.ctx.createGain();
        mar.type = 'sine';
        mar.frequency.setValueAtTime(barStep === 3 ? 587.33 : 739.99, now);
        mG.gain.setValueAtTime(0.0001, now);
        mG.gain.linearRampToValueAtTime(0.02, now + 0.004);
        mG.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
        mar.connect(mG);
        mG.connect(this.master);
        mar.start(now);
        mar.stop(now + 0.06);
      } else if (profile.percStyle === 'CLASSIC' && step === 30 && section % 2 === 1) {
        // Subtle Brazilian apito turnaround whistle chirps
        const apito = this.ctx.createOscillator();
        const apG = this.ctx.createGain();
        apito.type = 'sine';
        apito.frequency.setValueAtTime(2349.32, now);
        apito.frequency.exponentialRampToValueAtTime(2637.02, now + 0.065);
        apG.gain.setValueAtTime(0.0001, now);
        apG.gain.linearRampToValueAtTime(0.018, now + 0.008);
        apG.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
        apito.connect(apG);
        apG.connect(this.master);
        apito.start(now);
        apito.stop(now + 0.08);
      }
    }

    // 5. Stadium-Specific Lead Melody, Stereo Chorus Unison & Counter-Harmony
    const activeMelody =
      section === 0
        ? profile.melodySectionA
        : section === 1
          ? profile.melodySectionB
          : section === 2
            ? profile.melodySectionC
            : profile.melodySectionD;
    const noteFreq = activeMelody[step];
    if (noteFreq > 0 && (!isMenuGroove || step % 4 === 0)) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = isMenuGroove ? 'triangle' : profile.leadWave;
      filter.type = 'lowpass';
      const leadCutoff = isMenuGroove
        ? 980
        : superFlow
          ? profile.leadCutoff * 1.28
          : profile.leadCutoff;
      filter.frequency.setValueAtTime(leadCutoff, now);
      filter.frequency.exponentialRampToValueAtTime(560, now + profile.leadDecay);
      const targetFreq = isMenuGroove ? noteFreq * 0.5 : noteFreq;
      // Subtle Koto pitch-bend grace slide on Sakura Blossom Turf
      if (!isMenuGroove && profile.id === 'TURF_SAKURA' && step % 4 === 0) {
        osc.frequency.setValueAtTime(targetFreq * 0.97, now);
        osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.026);
      } else {
        osc.frequency.setValueAtTime(targetFreq, now);
      }
      const rawPeak = profile.leadWave === 'sawtooth' || profile.leadWave === 'square' ? 0.032 : 0.044;
      const leadPeak = isMenuGroove ? 0.026 : rawPeak;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(leadPeak, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + profile.leadDecay);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + profile.leadDecay + 0.02);

      // Subtle detuned unison chorus layer during B/D sections or Super Flow for lush 16-bit polish
      if (!isMenuGroove && (section === 1 || section === 3 || superFlow)) {
        const uOsc = this.ctx.createOscillator();
        const uG = this.ctx.createGain();
        uOsc.type = 'sine';
        uOsc.frequency.setValueAtTime(targetFreq, now);
        uOsc.detune.setValueAtTime(4.5, now);
        uG.gain.setValueAtTime(0.0001, now);
        uG.gain.linearRampToValueAtTime(leadPeak * 0.38, now + 0.012);
        uG.gain.exponentialRampToValueAtTime(0.0001, now + profile.leadDecay);
        uOsc.connect(filter);
        uG.connect(this.master);
        uOsc.start(now);
        uOsc.stop(now + profile.leadDecay + 0.02);
      }

      const harmFreq = profile.harmonyNotes[step];
      if (!isMenuGroove && (section === 1 || section === 3 || superFlow) && harmFreq > 0) {
        const hOsc = this.ctx.createOscillator();
        const hFilter = this.ctx.createBiquadFilter();
        const hG = this.ctx.createGain();
        hOsc.type = profile.harmonyWave;
        hFilter.type = 'lowpass';
        hFilter.frequency.setValueAtTime(1250, now);
        hOsc.frequency.setValueAtTime(harmFreq, now);
        const harmPeak = profile.harmonyWave === 'square' ? 0.014 : 0.022;
        hG.gain.setValueAtTime(0.0001, now);
        hG.gain.linearRampToValueAtTime(harmPeak, now + 0.012);
        hG.gain.exponentialRampToValueAtTime(0.0001, now + 0.185);
        hOsc.connect(hFilter);
        hFilter.connect(hG);
        hG.connect(this.master);
        hOsc.start(now);
        hOsc.stop(now + 0.2);
      }
    }

    // 6. Stadium-Specific Shimmer Arpeggio & Super-Flow Sparkle
    const ambientArpActive =
      superFlow ||
      (!isMenuGroove &&
        (this.currentPitchTheme === 'COSMIC_SPACE' ||
          this.currentPitchTheme === 'ARCTIC_ICE' ||
          this.currentPitchTheme === 'TWILIGHT_SYNTH' ||
          this.currentPitchTheme === 'TURF_SAKURA') &&
        barStep % 4 === 2);
    if (ambientArpActive && barStep % 2 === 0) {
      const arpFreq = profile.arpNotes[this.stepIndex % profile.arpNotes.length];
      const arpOsc = this.ctx.createOscillator();
      const arpG = this.ctx.createGain();
      arpOsc.type = this.currentPitchTheme === 'TWILIGHT_SYNTH' ? 'triangle' : 'sine';
      arpOsc.frequency.setValueAtTime(arpFreq, now);
      arpG.gain.setValueAtTime(0.0001, now);
      arpG.gain.linearRampToValueAtTime(superFlow ? 0.019 : 0.013, now + 0.007);
      arpG.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      arpOsc.connect(arpG);
      arpG.connect(this.master);
      arpOsc.start(now);
      arpOsc.stop(now + 0.105);
    }

    this.stepIndex++;
  }

  playUiHover() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.028);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.036);
  }

  playUiClick() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.055);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playUiSelect() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [587.33, 880.0].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.032);
      g.gain.setValueAtTime(0.0001, now + idx * 0.032);
      g.gain.linearRampToValueAtTime(0.12, now + idx * 0.032 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.032 + 0.075);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.032);
      osc.stop(now + idx * 0.032 + 0.085);
    });
  }

  playUiBack() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(440.0, now + 0.065);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  }


  playDribbleTap() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.04);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playChargeTick(power = 0.5, inSweetSpot = false) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = inSweetSpot ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(inSweetSpot ? 880 : 340 + power * 420, now);
    g.gain.setValueAtTime(inSweetSpot ? 0.13 : 0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (inSweetSpot ? 0.075 : 0.04));
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playPass(isCurved = false) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(215, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + 0.095);
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.11);
    this.playNoiseBurst(0.045, 1650, 0.2);
    if (isCurved) {
      this.playCurveWhoosh();
    }
  }

  playCurveWhoosh() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.12);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
    this.playNoiseBurst(0.12, 2400, 0.18, 2.2);
  }

  playCatch(comboCount = 1) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const scale = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const baseFreq = scale[Math.min(comboCount - 1, scale.length - 1)] || 440;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.09);
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playShoot(isSuper = false) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isSuper ? 310 : 230, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
    g.gain.setValueAtTime(isSuper ? 0.62 : 0.48, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.27);

    this.playNoiseBurst(isSuper ? 0.19 : 0.11, isSuper ? 2200 : 1400, isSuper ? 0.42 : 0.26, 0.9);
    if (isSuper) {
      this.playCurveWhoosh();
    }
  }

  playPostClang() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [820, 1290, 1940].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx === 1 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.32);
      g.gain.setValueAtTime(0.28 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  playNetSwish() {
    this.playNoiseBurst(0.24, 2900, 0.34, 1.8);
  }

  playKeeperSave() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(105, now + 0.15);
    g.gain.setValueAtTime(0.52, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
    this.playNoiseBurst(0.09, 950, 0.3);
  }

  playWallBounce() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(255, now);
    osc.frequency.exponentialRampToValueAtTime(84, now + 0.08);
    g.gain.setValueAtTime(0.38, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);

    // 16-bit metallic cage spark ping
    const ping = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1180, now);
    ping.frequency.exponentialRampToValueAtTime(640, now + 0.045);
    pg.gain.setValueAtTime(0.09, now);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    ping.connect(pg);
    pg.connect(this.master);
    ping.start(now);
    ping.stop(now + 0.055);
  }

  playTackle() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.15);
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.17);
    this.playNoiseBurst(0.08, 800, 0.25);
  }

  playSwitch() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.setValueAtTime(860, now + 0.032);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playPerfectStrike() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [587.33, 880.0, 1174.66, 1760.0].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.024);
      g.gain.setValueAtTime(0.28, now + idx * 0.024);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.024 + 0.22);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.024);
      osc.stop(now + idx * 0.024 + 0.24);
    });
  }

  playComboBonus() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);
      g.gain.setValueAtTime(0.26, now + idx * 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.2);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.03);
      osc.stop(now + idx * 0.03 + 0.22);
    });
  }

  playGoal(themeOverride?: PitchThemeId) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const activeTheme = themeOverride || this.currentPitchTheme;
    const profile = getStadiumMusicProfile(activeTheme);
    this.playNetSwish();

    const chimeNotes = profile.goalChimeNotes || [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    chimeNotes.forEach((freq, i) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = profile.leadWave === 'sine' ? 'triangle' : profile.leadWave;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2600, now + i * 0.048);
      osc.frequency.setValueAtTime(freq, now + i * 0.048);
      g.gain.setValueAtTime(0.28, now + i * 0.048);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.048 + 0.56);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(now + i * 0.048);
      osc.stop(now + i * 0.048 + 0.59);
    });

    // Subtle Stadium-Specific Goal Acoustic Flourish
    if (activeTheme === 'COSMIC_SPACE') {
      const ufoSweep = this.ctx.createOscillator();
      const ufoG = this.ctx.createGain();
      ufoSweep.type = 'sine';
      ufoSweep.frequency.setValueAtTime(440, now + 0.08);
      ufoSweep.frequency.exponentialRampToValueAtTime(1760, now + 0.48);
      ufoG.gain.setValueAtTime(0.14, now + 0.08);
      ufoG.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
      ufoSweep.connect(ufoG);
      ufoG.connect(this.master);
      ufoSweep.start(now + 0.08);
      ufoSweep.stop(now + 0.54);
    } else if (activeTheme === 'VOLCANO_FORGE') {
      const anvil = this.ctx.createOscillator();
      const aG = this.ctx.createGain();
      anvil.type = 'square';
      anvil.frequency.setValueAtTime(1318.51, now + 0.05);
      anvil.frequency.exponentialRampToValueAtTime(659.25, now + 0.25);
      aG.gain.setValueAtTime(0.12, now + 0.05);
      aG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      anvil.connect(aG);
      aG.connect(this.master);
      anvil.start(now + 0.05);
      anvil.stop(now + 0.3);
    }

    this.playNoiseBurst(0.95, 1100, 0.5, 0.8);
  }

  playWhistle() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2780, now);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(48, now);
    lfoGain.gain.setValueAtTime(140, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    g.gain.setValueAtTime(0.34, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(g);
    g.connect(this.master);
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.29);
    osc.stop(now + 0.29);
  }

  playMatchmakingTick(step = 0) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520 + (step % 3) * 80, now);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playMatchFound() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [587.33, 880.0, 1174.66].forEach((freq, i) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      g.gain.setValueAtTime(0.28, now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.22);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.24);
    });
  }

  playTournamentWin() {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const fanfareNotes = [
      { f: 523.25, d: 0.0, len: 0.16 },  // C5
      { f: 659.25, d: 0.11, len: 0.16 }, // E5
      { f: 783.99, d: 0.22, len: 0.16 }, // G5
      { f: 1046.5, d: 0.33, len: 0.32 }, // C6
      { f: 987.77, d: 0.58, len: 0.16 }, // B5
      { f: 1046.5, d: 0.72, len: 0.65 }, // C6
      { f: 1318.5, d: 0.72, len: 0.65 }, // E6
      { f: 1567.98, d: 0.72, len: 0.75 }, // G6
    ];
    fanfareNotes.forEach(({ f, d, len }) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t + d);
      gain.gain.setValueAtTime(0.0001, t + d);
      gain.gain.linearRampToValueAtTime(0.28, t + d + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d + len);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t + d);
      osc.stop(t + d + len + 0.03);
    });
    // Celebratory crowd & snare burst
    this.playNoiseBurst(0.55, 1600, 0.22, 1.2);
  }

  playSlotSpin(machineOverride?: PokieMachineId) {
    this.unlock();
    if (machineOverride) this.currentPokieMachine = machineOverride;
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const prof = getPokieSoundProfile(this.currentPokieMachine);

    // Machine-themed lever clunk / warp / anvil / vault lock + ascending synth sweep
    const clunk = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    clunk.type = prof.id === 'COSMIC_NEON' ? 'sine' : 'sawtooth';
    clunk.frequency.setValueAtTime(prof.spinClunkStart, now);
    clunk.frequency.exponentialRampToValueAtTime(prof.spinClunkEnd, now + 0.068);
    cg.gain.setValueAtTime(0.24, now);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.078);
    clunk.connect(cg);
    cg.connect(this.master);
    clunk.start(now);
    clunk.stop(now + 0.085);

    prof.spinNotes.forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = prof.spinWave;
      osc.frequency.setValueAtTime(freq, now + idx * 0.024);
      g.gain.setValueAtTime(0.0001, now + idx * 0.024);
      g.gain.linearRampToValueAtTime(prof.spinWave === 'sawtooth' ? 0.14 : 0.2, now + idx * 0.024 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.024 + 0.085);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.024);
      osc.stop(now + idx * 0.024 + 0.09);
    });
    this.playNoiseBurst(0.055, prof.spinNoiseFreq, 0.15, 1.6);
  }

  playSlotReelTick(reelIdx = 0) {
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const prof = getPokieSoundProfile(this.currentPokieMachine);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = prof.tickWave;
    const baseFreq = prof.tickBaseFreq + reelIdx * prof.tickReelStep + (Math.random() - 0.5) * 40;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, now + 0.024);
    g.gain.setValueAtTime(prof.tickWave === 'square' ? 0.055 : 0.08, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.028);
  }

  playSlotReelStop(reelIdx = 0, isTeaser = false) {
    this.unlock();
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const prof = getPokieSoundProfile(this.currentPokieMachine);

    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = prof.stopWave;
    const pitch = prof.stopPitches[reelIdx % 3] || 220;
    thud.frequency.setValueAtTime(pitch * 1.45, now);
    thud.frequency.exponentialRampToValueAtTime(54, now + 0.085);
    tg.gain.setValueAtTime(prof.stopWave === 'sawtooth' ? 0.24 : 0.32, now);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    thud.connect(tg);
    tg.connect(this.master);
    thud.start(now);
    thud.stop(now + 0.1);

    // Machine-themed harmonic lock ping
    const ping = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    ping.type = prof.id === 'VOLCANO_INFERNO' ? 'square' : 'sine';
    ping.frequency.setValueAtTime(pitch * prof.stopPingMult, now);
    pg.gain.setValueAtTime(prof.id === 'VOLCANO_INFERNO' ? 0.09 : 0.14, now);
    pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    ping.connect(pg);
    pg.connect(this.master);
    ping.start(now);
    ping.stop(now + 0.07);

    if (isTeaser) {
      prof.teaserNotes.forEach((freq, i) => {
        if (!this.ctx || !this.master) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = prof.winWave;
        osc.frequency.setValueAtTime(freq, now + i * 0.045);
        g.gain.setValueAtTime(0.2, now + i * 0.045);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.045 + 0.15);
        osc.connect(g);
        g.connect(this.master);
        osc.start(now + i * 0.045);
        osc.stop(now + i * 0.045 + 0.16);
      });
    }
  }

  playSlotWin(tier: 'SMALL' | 'BIG' | 'MEGA' | 'JACKPOT' = 'SMALL') {
    this.unlock();
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const prof = getPokieSoundProfile(this.currentPokieMachine);
    const notes = prof.winNotes[tier] || prof.winNotes.SMALL;
    const stepTime = tier === 'JACKPOT' ? 0.065 : tier === 'MEGA' ? 0.055 : 0.048;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = tier === 'JACKPOT' || tier === 'MEGA' ? prof.winWave : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * stepTime);
      g.gain.setValueAtTime(0.0001, now + idx * stepTime);
      g.gain.linearRampToValueAtTime(prof.winWave === 'sawtooth' ? 0.2 : 0.28, now + idx * stepTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * stepTime + 0.36);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * stepTime);
      osc.stop(now + idx * stepTime + 0.38);
    });

    if (tier === 'JACKPOT' || tier === 'MEGA') {
      this.playNoiseBurst(0.65, prof.spinNoiseFreq, 0.26, 1.1);
    }
  }

  playCoinTick(step = 0, totalSteps = 10) {
    this.unlock();
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const prog = Math.max(0, Math.min(1, step / Math.max(1, totalSteps - 1)));
    // Classic 16-bit dual-tone gold coin clink (B5 -> E6) that rises slightly as the counter climbs
    const f1 = 987.77 * (1 + prog * 0.18);
    const f2 = 1318.51 * (1 + prog * 0.18);

    const osc1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f1, now);
    g1.gain.setValueAtTime(0.14, now);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc1.connect(g1);
    g1.connect(this.master);
    osc1.start(now);
    osc1.stop(now + 0.05);

    const osc2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(f2, now + 0.022);
    g2.gain.setValueAtTime(0.18, now + 0.022);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    osc2.connect(g2);
    g2.connect(this.master);
    osc2.start(now + 0.022);
    osc2.stop(now + 0.1);
  }

  playMatchCashReward(isBigReward = false) {
    this.unlock();
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const chord = isBigReward
      ? [587.33, 880.0, 1174.66, 1760.0]
      : [523.25, 783.99, 1046.5, 1567.98];
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.042);
      g.gain.setValueAtTime(0.0001, now + idx * 0.042);
      g.gain.linearRampToValueAtTime(0.24, now + idx * 0.042 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.042 + 0.28);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.042);
      osc.stop(now + idx * 0.042 + 0.3);
    });
  }

  playCouponRedeem() {
    this.unlock();
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    [587.33, 739.99, 880.0, 1174.66, 1479.98].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.038);
      g.gain.setValueAtTime(0.24, now + idx * 0.038);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.038 + 0.24);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.038);
      osc.stop(now + idx * 0.038 + 0.26);
    });
  }

  playHoldAndSpinTrigger() {
    this.unlock();
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const prof = getPokieSoundProfile(this.currentPokieMachine);

    // Machine-themed bonus siren + ascending synth fanfare
    const siren = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    siren.type = prof.holdSirenWave;
    siren.frequency.setValueAtTime(prof.holdSirenStart, now);
    siren.frequency.exponentialRampToValueAtTime(prof.holdSirenEnd, now + 0.34);
    sg.gain.setValueAtTime(0.18, now);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    siren.connect(sg);
    sg.connect(this.master);
    siren.start(now);
    siren.stop(now + 0.4);

    prof.holdTriggerNotes.forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = prof.winWave;
      const t0 = now + 0.08 + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(prof.winWave === 'sawtooth' ? 0.2 : 0.28, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.34);
    });
    this.playNoiseBurst(0.45, prof.spinNoiseFreq, 0.24, 1.3);
  }

  playHoldOrbLock(lockedCount = 3) {
    this.unlock();
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const prof = getPokieSoundProfile(this.currentPokieMachine);

    const thump = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thump.type = prof.stopWave;
    thump.frequency.setValueAtTime(prof.spinClunkStart, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    tg.gain.setValueAtTime(0.32, now);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    thump.connect(tg);
    tg.connect(this.master);
    thump.start(now);
    thump.stop(now + 0.14);

    const scaleNotes = prof.orbLockScale;
    const baseNote = scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, lockedCount - 1))] || 783.99;

    [baseNote, baseNote * 1.5].forEach((freq, idx) => {
      if (!this.ctx || !this.master) return;
      const bell = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      bell.type = prof.id === 'VOLCANO_INFERNO' ? 'triangle' : 'sine';
      bell.frequency.setValueAtTime(freq, now + idx * 0.035);
      bg.gain.setValueAtTime(0.24, now + idx * 0.035);
      bg.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.035 + 0.24);
      bell.connect(bg);
      bg.connect(this.master);
      bell.start(now + idx * 0.035);
      bell.stop(now + idx * 0.035 + 0.26);
    });
  }

  playHoldAndSpinComplete(isGrandJackpot = false) {
    this.unlock();
    if (!this.ensureReady() || !this.ctx || !this.master) return;
    if (isGrandJackpot) {
      this.playSlotWin('JACKPOT');
    } else {
      this.playSlotWin('MEGA');
    }
  }
}

/**
 * Triggers Gamepad haptic dual-rumble if a controller with vibrationActuator is connected.
 */
export function triggerGamepadRumble(durationMs = 70, weakMagnitude = 0.35, strongMagnitude = 0.6) {
  try {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i] as (Gamepad & {
        vibrationActuator?: {
          playEffect: (
            type: string,
            params: { startDelay: number; duration: number; weakMagnitude: number; strongMagnitude: number }
          ) => Promise<void>;
        };
      }) | null;
      if (gp && gp.connected && gp.vibrationActuator && typeof gp.vibrationActuator.playEffect === 'function') {
        gp.vibrationActuator
          .playEffect('dual-rumble', {
            startDelay: 0,
            duration: durationMs,
            weakMagnitude,
            strongMagnitude,
          })
          .catch(() => {});
      }
    }
  } catch {
    // Ignore vibration API errors
  }
}
