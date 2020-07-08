// Simple composer
//
// Virtual Megus
// 2019-2020, Roman "Megus" Petrov

'use strict';

class Composer1 extends Composer {
  /**
   *
   * @param {Mixer} mixer
   * @param {Sequencer} sequencer
   */
  constructor(mixer, sequencer) {
    super(mixer, sequencer);
    this.pitchTable = create12TETPitchTable(440.0);
    this.stepCallback = this.stepCallback.bind(this);
  }

  /**
   *
   * @param {Unit} unit
   * @param {number} gain
   * @param {number} reverb
   * @param {number} delay
   */
  createChannel(unit, gain, reverb, delay) {
    const channel = new MixerChannel(unit);
    channel.gainNode.gain.value = gain;
    channel.unitReverbSend = reverb;
    channel.delay.input.gain.value = delay;
    this.mixer.addChannel(channel);
    return channel;
  }

  async setupEnsemble() {
    const context = this.mixer.context;
    const pitchTable = this.pitchTable;

    const pool = {
      drums: [
        this.createChannel(new DrumMachine(context, drumKits["tr808"]), 1, 0.1, 0),
      ],
      bass: [
        this.createChannel(new MonoSynth(context, pitchTable, synthPresets["bass"]), 1, 0, 0),
      ],
      pad: [
        this.createChannel(new PolySynth(context, pitchTable, synthPresets["pad"]), 0.2, 1, 0.1),
      ],
      melody: [
        this.createChannel(new MonoSynth(context, pitchTable, synthPresets["lead1"]), 0.9, 0.3, 0.2),
        this.createChannel(new MonoSynth(context, pitchTable, synthPresets["lead2"]), 0.9, 0.3, 0.2),
      ],
      arpeggio: [
        this.createChannel(new PolySynth(context, pitchTable, synthPresets["arp"]), 0.4, 0.7, 0.2),
      ],
    };

    this.pool = pool;
  }

  start() {
    this.generators = {
      drums: new GDrums1(),
      bass: new GBass1(),
      pad: new GPad1(),
      melody: new GMelody1(),
      arpeggio: new GArp1(),
    };

    this.patternStep = 0;

    // Prepare sequencer
    this.sequencer.setBPM(120);
    this.sequencer.addStepCallback(this.stepCallback);

    // Add first patterns
    this.initState();
    this.generatePatterns();
  }

  stop() {
    this.sequencer.removeStepCallback(this.stepCallback);
    for (const partId in this.pool) {
      const part = this.pool[partId];
      part.forEach((channel) => {
        this.mixer.removeChannel(channel);
      });
    }
    this.generators = {};
  }

  stepCallback(time, step) {
    if (step % this.state.patternLength == this.state.patternLength - 4) {
      this.patternStep += this.state.patternLength;
      this.nextState();
      this.generatePatterns();
    }
  }

  generatePatterns() {
    //console.log("Generating next patterns");
    this.state.parts.forEach((partInfo) => {
      let part = "";
      let instrument = 0;
      if (typeof partInfo == "string") {
        part = partInfo;
      } else {
        part = partInfo[0];
        instrument = partInfo[1];
      }

      this.sequencer.addEvents(
        this.pool[part][instrument],
        this.generators[part].nextEvents(this.state),
        this.patternStep,
      );
    });
  }

  expandHarmony(harmonyMap) {
    const harmony = [];
    for (let c = 0; c < this.state.patternLength; c++) {
      harmony.push(-1);
    }
    for (const step in harmonyMap) {
      harmony[step] = harmonyMap[step];
    }
    let chord = harmony[0];
    for (let c = 0; c < this.state.patternLength; c++) {
      if (harmony[c] != -1) {
        chord = harmony[c];
      }
      harmony[c] = chord;
    }
    return harmony;
  }




  // Actual composing logic

  initState() {
    const key = 0; // C
    const scale = 5; // Minor

    this.harmonies = {};
    this.state = {
      key: key,
      scale: scale,
      scalePitches: diatonicScalePitches(key, scale, this.pitchTable),
    };

    this.setupSection("intro");
  }

  /**
   * Next state
   */
  nextState() {
    this.state.sectionPattern++;
    if (this.state.sectionPattern == this.state.sectionLength) {
      this.nextSection();
    }
  }

  randomChord() {
    let chord = Math.floor(Math.random() * 7);
    if (chord == (6 - this.state.scale)) {
      chord += Math.floor(Math.random() * 3) + 1;
    }
    chord = chord % 7;

    return chord;
  }

  generateHarmony(section) {
    if (this.harmonies[section] == null) {
      this.harmonies[section] = {
        0: 0,
        16: this.randomChord(),
        32: this.randomChord(),
        48: this.randomChord(),
      }
    }
    return this.harmonies[section];
  }

  /**
   * Setup a new song section
   * @param {string} name
   */
  setupSection(name) {
    console.log("Setting up section " + name);
    this.state.section = name;
    this.state.patternLength = 64;
    this.state.harmony = this.expandHarmony(this.generateHarmony(name));
    this.state.sectionPattern = 0;

    if (name == "intro") {
      this.state.sectionLength = 2;
      this.state.parts = ["pad", "arpeggio"];
    } else if (name == "verse") {
      this.state.sectionLength = 2;
      this.state.parts = ["drums", "bass", "pad", "melody"];
    } else if (name == "chorus") {
      this.state.sectionLength = 2;
      this.state.parts = ["drums", "bass", "pad", "arpeggio", ["melody", 1]];
    } else if (name == "bridge") {
      this.state.sectionLength = 1;
      this.state.parts = ["drums", "bass", "pad", "arpeggio"];
    } else if (name == "s1") {
      this.state.sectionLength = 2;
      this.state.parts = ["drums", "bass", "arpeggio"];
    } else if (name == "s2") {
      this.state.sectionLength = 4;
      this.state.parts = ["bass", "pad", "arpeggio"];
    }
  }

  nextSection() {
    const current = this.state.section;
    let next = current;
    if (current == "intro") {
      next = (Math.random() > 0.3) ? "verse" : "bridge";
    } else if (current == "verse") {
      next = "chorus";
    } else if (current == "chorus") {
      next = (Math.random() > 0.7) ? "verse" : "bridge";
    } else if (current == "bridge") {
      next = (Math.random() > 0.5) ? ((Math.random() > 0.5) ? "s1" : "s2") : "verse";
    } else if (current == "s1") {
      next = (Math.random() > 0.5) ? "bridge" : "s2";
    } else if (current == "s2") {
      next = (Math.random() > 0.5) ? "s1" : "bridge";
    }

    this.setupSection(next);
  }
}