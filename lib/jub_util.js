module.exports = {

  // Call to apply some monkey-patches various classes
  monkey_patch: function() {

    if ( typeof String.prototype.starts_with != 'function' ) {
      String.prototype.starts_with = function( substr ) {
        return this.indexOf(substr) === 0;
      };
    };

    if ( typeof Array.prototype.partition != 'function' ) {
      Array.prototype.partition = function( iterator, thisArg ) {
        var trueCollection = [];
        var falseCollection = [];
        this.forEach(function(v, i, arr) {
          if (iterator.call(thisArg, v, i, arr)) {
            trueCollection.push(v);
          } else {
            falseCollection.push(v);
          }
        });

        return [trueCollection, falseCollection];
      };
    };

    // Someone else suggested:
    //   myArray.reduce(Function.prototype.apply.bind(Array.prototype.concat))
    if ( typeof Array.prototype.flatten != 'function' ) {
      Array.prototype.flatten = function() {
        var recur = function(a) {
          return (a instanceof Array) ? ([].concat.apply([], a.map(recur))) : a
        };
        return recur(this);
      };
    };
  },

  // Recursive object inspection
  inspect: function xinspect(o, i) {
    if (typeof i == 'undefined') i = '';
    if (i.length > 50) return '[MAX ITERATIONS]';
    var r = [];
    for(var p in o) {
      var t = typeof o[p];
      r.push(
        i + p + ' (' + t + '): ' +
        (t == 'object' ? 'object:' + xinspect(o[p], i + '  ') : o[p] + '')
      );
    }
    return r.join(i + '\n');
  },

  //http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  knuth_shuffle: function _shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  },

  // Clear an object's properties
  clear_obj: function(obj) {
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) { delete obj[prop]; }
    }
  },
}
