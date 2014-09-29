(function() {
  var __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  module.exports = function(HB) {
    var Delete, Delimiter, ImmutableObject, Insert, Operation, execution_listener, parser;
    parser = {};
    execution_listener = [];
    Operation = (function() {
      function Operation(uid) {
        this.is_deleted = false;
        this.doSync = true;
        this.garbage_collected = false;
        if (uid == null) {
          uid = HB.getNextOperationIdentifier();
        }
        if (uid.doSync == null) {
          uid.doSync = !isNaN(parseInt(uid.op_number));
        }
        this.creator = uid['creator'], this.op_number = uid['op_number'], this.doSync = uid['doSync'];
      }

      Operation.prototype.type = "Insert";

      Operation.prototype.on = function(events, f) {
        var e, _base, _i, _len, _results;
        if (this.event_listeners == null) {
          this.event_listeners = {};
        }
        if (events.constructor !== [].constructor) {
          events = [events];
        }
        _results = [];
        for (_i = 0, _len = events.length; _i < _len; _i++) {
          e = events[_i];
          if ((_base = this.event_listeners)[e] == null) {
            _base[e] = [];
          }
          _results.push(this.event_listeners[e].push(f));
        }
        return _results;
      };

      Operation.prototype.deleteListener = function(events, f) {
        var e, _i, _len, _ref, _results;
        if (events.constructor !== [].constructor) {
          events = [events];
        }
        _results = [];
        for (_i = 0, _len = events.length; _i < _len; _i++) {
          e = events[_i];
          if (((_ref = this.event_listeners) != null ? _ref[e] : void 0) != null) {
            _results.push(this.event_listeners[e] = this.event_listeners[e].filter(function(g) {
              return f !== g;
            }));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      };

      Operation.prototype.callEvent = function() {
        return this.forwardEvent.apply(this, [this].concat(__slice.call(arguments)));
      };

      Operation.prototype.forwardEvent = function() {
        var args, event, f, op, _i, _len, _ref, _ref1, _results;
        op = arguments[0], event = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
        if (((_ref = this.event_listeners) != null ? _ref[event] : void 0) != null) {
          _ref1 = this.event_listeners[event];
          _results = [];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            f = _ref1[_i];
            _results.push(f.call.apply(f, [op, event].concat(__slice.call(args))));
          }
          return _results;
        }
      };

      Operation.prototype.isDeleted = function() {
        return this.is_deleted;
      };

      Operation.prototype.applyDelete = function(garbagecollect) {
        if (garbagecollect == null) {
          garbagecollect = true;
        }
        if (!this.garbage_collected) {
          this.is_deleted = true;
          if (garbagecollect) {
            this.garbage_collected = true;
            return HB.addToGarbageCollector(this);
          }
        }
      };

      Operation.prototype.cleanup = function() {
        return HB.removeOperation(this);
      };

      Operation.prototype.setParent = function(parent) {
        this.parent = parent;
      };

      Operation.prototype.getParent = function() {
        return this.parent;
      };

      Operation.prototype.getUid = function() {
        return {
          'creator': this.creator,
          'op_number': this.op_number,
          'sync': this.doSync
        };
      };

      Operation.prototype.dontSync = function() {
        return this.doSync = false;
      };

      Operation.prototype.execute = function() {
        var l, _i, _len;
        this.is_executed = true;
        for (_i = 0, _len = execution_listener.length; _i < _len; _i++) {
          l = execution_listener[_i];
          l(this._encode());
        }
        return this;
      };

      Operation.prototype.saveOperation = function(name, op) {
        if ((op != null ? op.execute : void 0) != null) {
          return this[name] = op;
        } else if (op != null) {
          if (this.unchecked == null) {
            this.unchecked = {};
          }
          return this.unchecked[name] = op;
        }
      };

      Operation.prototype.validateSavedOperations = function() {
        var name, op, op_uid, success, uninstantiated, _ref;
        uninstantiated = {};
        success = this;
        _ref = this.unchecked;
        for (name in _ref) {
          op_uid = _ref[name];
          op = HB.getOperation(op_uid);
          if (op) {
            this[name] = op;
          } else {
            uninstantiated[name] = op_uid;
            success = false;
          }
        }
        delete this.unchecked;
        if (!success) {
          this.unchecked = uninstantiated;
        }
        return success;
      };

      return Operation;

    })();
    Delete = (function(_super) {
      __extends(Delete, _super);

      function Delete(uid, deletes) {
        this.saveOperation('deletes', deletes);
        Delete.__super__.constructor.call(this, uid);
      }

      Delete.prototype.type = "Delete";

      Delete.prototype._encode = function() {
        return {
          'type': "Delete",
          'uid': this.getUid(),
          'deletes': this.deletes.getUid()
        };
      };

      Delete.prototype.execute = function() {
        if (this.validateSavedOperations()) {
          this.deletes.applyDelete(this);
          return Delete.__super__.execute.apply(this, arguments);
        } else {
          return false;
        }
      };

      return Delete;

    })(Operation);
    parser['Delete'] = function(o) {
      var deletes_uid, uid;
      uid = o['uid'], deletes_uid = o['deletes'];
      return new Delete(uid, deletes_uid);
    };
    Insert = (function(_super) {
      __extends(Insert, _super);

      function Insert(uid, prev_cl, next_cl, origin) {
        this.saveOperation('prev_cl', prev_cl);
        this.saveOperation('next_cl', next_cl);
        if (origin != null) {
          this.saveOperation('origin', origin);
        } else {
          this.saveOperation('origin', prev_cl);
        }
        Insert.__super__.constructor.call(this, uid);
      }

      Insert.prototype.type = "Insert";

      Insert.prototype.applyDelete = function(o) {
        var garbagecollect, _ref;
        if (this.deleted_by == null) {
          this.deleted_by = [];
        }
        if ((this.parent != null) && !this.isDeleted()) {
          this.parent.callEvent("delete", this, o);
        }
        if (o != null) {
          this.deleted_by.push(o);
        }
        garbagecollect = false;
        if (!((this.prev_cl != null) && (this.next_cl != null)) || this.prev_cl.isDeleted()) {
          garbagecollect = true;
        }
        Insert.__super__.applyDelete.call(this, garbagecollect);
        if ((_ref = this.next_cl) != null ? _ref.isDeleted() : void 0) {
          return this.next_cl.applyDelete();
        }
      };

      Insert.prototype.cleanup = function() {
        var d, o, _i, _len, _ref, _ref1;
        if ((_ref = this.prev_cl) != null ? _ref.isDeleted() : void 0) {
          _ref1 = this.deleted_by;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            d = _ref1[_i];
            d.cleanup();
          }
          o = this.next_cl;
          while (o.type !== "Delimiter") {
            if (o.origin === this) {
              o.origin = this.prev_cl;
            }
            o = o.next_cl;
          }
          this.prev_cl.next_cl = this.next_cl;
          this.next_cl.prev_cl = this.prev_cl;
          return Insert.__super__.cleanup.apply(this, arguments);
        }
      };

      Insert.prototype.getDistanceToOrigin = function() {
        var d, o;
        d = 0;
        o = this.prev_cl;
        while (true) {
          if (this.origin === o) {
            break;
          }
          d++;
          o = o.prev_cl;
        }
        return d;
      };

      Insert.prototype.execute = function(fire_event) {
        var distance_to_origin, i, o, parent, _ref;
        if (fire_event == null) {
          fire_event = true;
        }
        if (!this.validateSavedOperations()) {
          return false;
        } else {
          if (this.prev_cl != null) {
            distance_to_origin = this.getDistanceToOrigin();
            o = this.prev_cl.next_cl;
            i = distance_to_origin;
            while (true) {
              if (o !== this.next_cl) {
                if (o.getDistanceToOrigin() === i) {
                  if (o.creator < this.creator) {
                    this.prev_cl = o;
                    distance_to_origin = i + 1;
                  } else {

                  }
                } else if (o.getDistanceToOrigin() < i) {
                  if (i - distance_to_origin <= o.getDistanceToOrigin()) {
                    this.prev_cl = o;
                    distance_to_origin = i + 1;
                  } else {

                  }
                } else {
                  break;
                }
                i++;
                o = o.next_cl;
              } else {
                break;
              }
            }
            this.next_cl = this.prev_cl.next_cl;
            this.prev_cl.next_cl = this;
            this.next_cl.prev_cl = this;
          }
          parent = (_ref = this.prev_cl) != null ? _ref.getParent() : void 0;
          if ((parent != null) && fire_event) {
            this.setParent(parent);
            this.parent.callEvent("insert", this);
          }
          return Insert.__super__.execute.apply(this, arguments);
        }
      };

      Insert.prototype.getPosition = function() {
        var position, prev;
        position = 0;
        prev = this.prev_cl;
        while (true) {
          if (prev instanceof Delimiter) {
            break;
          }
          if (!prev.isDeleted()) {
            position++;
          }
          prev = prev.prev_cl;
        }
        return position;
      };

      return Insert;

    })(Operation);
    ImmutableObject = (function(_super) {
      __extends(ImmutableObject, _super);

      function ImmutableObject(uid, content, prev, next, origin) {
        this.content = content;
        ImmutableObject.__super__.constructor.call(this, uid, prev, next, origin);
      }

      ImmutableObject.prototype.type = "ImmutableObject";

      ImmutableObject.prototype.val = function() {
        return this.content;
      };

      ImmutableObject.prototype._encode = function() {
        var json;
        json = {
          'type': "ImmutableObject",
          'uid': this.getUid(),
          'content': this.content
        };
        if (this.prev_cl != null) {
          json['prev'] = this.prev_cl.getUid();
        }
        if (this.next_cl != null) {
          json['next'] = this.next_cl.getUid();
        }
        if (this.origin != null) {
          json["origin"] = this.origin().getUid();
        }
        return json;
      };

      return ImmutableObject;

    })(Operation);
    parser['ImmutableObject'] = function(json) {
      var content, next, origin, prev, uid;
      uid = json['uid'], content = json['content'], prev = json['prev'], next = json['next'], origin = json['origin'];
      return new ImmutableObject(uid, content, prev, next, origin);
    };
    Delimiter = (function(_super) {
      __extends(Delimiter, _super);

      function Delimiter(uid, prev_cl, next_cl, origin) {
        this.saveOperation('prev_cl', prev_cl);
        this.saveOperation('next_cl', next_cl);
        this.saveOperation('origin', prev_cl);
        Delimiter.__super__.constructor.call(this, uid);
      }

      Delimiter.prototype.type = "Delimiter";

      Delimiter.prototype.applyDelete = function() {
        var o;
        Delimiter.__super__.applyDelete.call(this);
        o = this.next_cl;
        while (o != null) {
          o.applyDelete();
          o = o.next_cl;
        }
        return void 0;
      };

      Delimiter.prototype.cleanup = function() {
        return Delimiter.__super__.cleanup.call(this);
      };

      Delimiter.prototype.execute = function() {
        var _ref, _ref1;
        if (((_ref = this.unchecked) != null ? _ref['next_cl'] : void 0) != null) {
          return Delimiter.__super__.execute.apply(this, arguments);
        } else if ((_ref1 = this.unchecked) != null ? _ref1['prev_cl'] : void 0) {
          if (this.validateSavedOperations()) {
            if (this.prev_cl.next_cl != null) {
              throw new Error("Probably duplicated operations");
            }
            this.prev_cl.next_cl = this;
            delete this.prev_cl.unchecked.next_cl;
            return Delimiter.__super__.execute.apply(this, arguments);
          } else {
            return false;
          }
        } else if ((this.prev_cl != null) && (this.prev_cl.next_cl == null)) {
          delete this.prev_cl.unchecked.next_cl;
          return this.prev_cl.next_cl = this;
        } else if ((this.prev_cl != null) || (this.next_cl != null)) {
          return Delimiter.__super__.execute.apply(this, arguments);
        } else {
          throw new Error("Delimiter is unsufficient defined!");
        }
      };

      Delimiter.prototype._encode = function() {
        var _ref, _ref1;
        return {
          'type': "Delimiter",
          'uid': this.getUid(),
          'prev': (_ref = this.prev_cl) != null ? _ref.getUid() : void 0,
          'next': (_ref1 = this.next_cl) != null ? _ref1.getUid() : void 0
        };
      };

      return Delimiter;

    })(Operation);
    parser['Delimiter'] = function(json) {
      var next, prev, uid;
      uid = json['uid'], prev = json['prev'], next = json['next'];
      return new Delimiter(uid, prev, next);
    };
    return {
      'types': {
        'Delete': Delete,
        'Insert': Insert,
        'Delimiter': Delimiter,
        'Operation': Operation,
        'ImmutableObject': ImmutableObject
      },
      'parser': parser,
      'execution_listener': execution_listener
    };
  };

}).call(this);

//# sourceMappingURL=../Types/BasicTypes.js.map