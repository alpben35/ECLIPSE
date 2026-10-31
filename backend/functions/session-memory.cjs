// Persistent, bounded equivalent of the local Python SessionMemory API.
// Identity is supplied by verified Firebase Auth, never by request-body user IDs.
class FirestoreSessionMemory {
  constructor(db, uid) {
    if (typeof uid !== 'string' || !uid || uid.includes('/')) throw Error('MEMORY_IDENTITY');
    this.db = db;
    this.ref = db.doc('eclipse_agent_memory/' + uid);
  }
  async read() {
    const data = (await this.ref.get()).data() || {};
    return { revision: data.revision || 0, history: data.history || [], items: data.items || [] };
  }
  async retrieveContext(itemCode) {
    const data = await this.read();
    return data.items.find(item => item.itemCode === itemCode)?.computedAnswer ?? null;
  }
  async storeContext(itemCode, computedAnswer, prompt, expectedRevision) {
    if (typeof itemCode !== 'string' || !itemCode || itemCode.length > 100 || typeof computedAnswer !== 'string' || computedAnswer.length > 12000 || typeof prompt !== 'string' || prompt.length > 4000) throw Error('MEMORY_INPUT');
    return this.db.runTransaction(async tx => {
      const data = (await tx.get(this.ref)).data() || {};
      if ((data.revision || 0) !== expectedRevision) return false;
      const items = (data.items || []).filter(item => item.itemCode !== itemCode);
      items.push({itemCode, computedAnswer});
      const history = [...(data.history || []), {role:'user',text:prompt}, {role:'model',text:computedAnswer}].slice(-8);
      tx.set(this.ref, {revision: expectedRevision + 1, items: items.slice(-20), history});
      return true;
    });
  }
  async clear() {
    // Keep a revision tombstone: in-flight generations cannot resurrect deleted context.
    await this.db.runTransaction(async tx => {
      const data = (await tx.get(this.ref)).data() || {};
      tx.set(this.ref, {revision: (data.revision || 0) + 1, history: [], items: []});
    });
  }
}
module.exports = {FirestoreSessionMemory};
