// In-memory stub for development — replace with real DB model later.
const _store = [];

class UserSettings {
  static async findOne(query) {
    return _store.find(s => s.userId === (query && query.userId)) || null;
  }
  static async find(query = {}) {
    return _store.slice();
  }
  static async findOneAndUpdate(filter, update, options = {}) {
    let rec = _store.find(s => s.userId === filter.userId);
    if (rec) {
      Object.assign(rec, update);
    } else {
      rec = Object.assign({}, update);
      _store.push(rec);
    }
    return rec;
  }
}

module.exports = UserSettings;

