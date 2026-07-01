export class HapticEngine {
  private enabled = true;

  setEnabled(v: boolean) { this.enabled = v; }

  private vibrate(pattern: number | number[]) {
    if (!this.enabled) return;
    if (!('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore security errors or permission errors with vibrating in browsers
    }
  }

  // === Navigation ===
  nextParagraph()    { this.vibrate(8); }          // soft single tick
  prevParagraph()    { this.vibrate([4, 4]); }     // reverse double tap
  chapterEnd()       { this.vibrate([15, 30, 15]); } // achievement
  bookEnd()          { this.vibrate([30, 40, 30, 40]); }

  // === Interactions ===
  bookmark()         { this.vibrate(15); } // snap to saved
  highlight()        { this.vibrate([10, 10]); } // brush strokes
  like()             { this.vibrate([10, 20, 15]); } // heart pulse
  wordTap()          { this.vibrate(6); }             // soft response
  longPress()        { this.vibrate(20); }            // confirm press

  // === System ===
  importSuccess()    { this.vibrate([10, 30, 10]); }
  error()            { this.vibrate([30, 30, 30]); }
  themeChange()      { this.vibrate(12); }
  fontSizeChange()   { this.vibrate(4); }
  hudToggle()        { this.vibrate(6); }
  drawerOpen()       { this.vibrate(10); }
  drawerClose()      { this.vibrate(8); }
}

export const haptic = new HapticEngine();
