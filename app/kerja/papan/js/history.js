export class HistoryManager {
  constructor() {
    this.past = [];
    this.future = [];
    this.MAX_HISTORY = 100;
  }

  push(elements) {
    // Save state snapshot
    this.past.push(JSON.stringify(elements));
    this.future = []; // Clear redo stack on new action
    
    if (this.past.length > this.MAX_HISTORY) {
      this.past.shift();
    }
  }

  undo(currentElements) {
    if (this.past.length === 0) return null;
    
    this.future.push(JSON.stringify(currentElements));
    const previous = this.past.pop();
    return JSON.parse(previous);
  }

  redo(currentElements) {
    if (this.future.length === 0) return null;

    this.past.push(JSON.stringify(currentElements));
    const next = this.future.pop();
    return JSON.parse(next);
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}
