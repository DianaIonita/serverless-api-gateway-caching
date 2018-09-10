class ServerlessFunction {
  constructor(name) {
    this[name] = {
    }
  }

  getFunction() {
    return this[Object.keys(this)[0]];
  }

  withHttpEndpoint(method, path, caching) {
    let f = this.getFunction();
    if (!f.events) { f.events = []; }
    f.events.push({
      http: {
        path,
        method,
        caching
      }
    })

    return this;
  }
}

module.exports = ServerlessFunction;
