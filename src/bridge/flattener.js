/**
 * Helps flatten a go board into a diagram definition.
 */
glift.bridge.flattener = {
  symbols: {
    //----------------------------------------//
    // First Layer Symbols (lines and stones) //
    //----------------------------------------//
    // Base board marks
    TL_CORNER: 1,
    TR_CORNER: 2,
    BL_CORNER: 3,
    BR_CORNER: 4,
    TOP_EDGE: 5,
    BOT_EDGE: 6,
    LEFT_EDGE: 7,
    RIGHT_EDGE: 8,
    CENTER: 9,
    // Center + starpoint
    CENTER_STARPOINT: 10,
    // Stones
    BSTONE: 11,
    WSTONE: 12,

    // A dummy symbol so we can create dense arrays of mark symbols.  Also used
    // for removed the first layer when we wish to add text labels.
    EMPTY: 13,

    //-----------------------------------------//
    // Second Layer Symbols (labels and marks) //
    //-----------------------------------------//
    // Marks and StoneMarks
    TRIANGLE: 14,
    SQUARE: 15,
    CIRCLE: 16,
    XMARK: 17,
    // Text Labeling (numbers or letters)
    TEXTLABEL: 18,
    // Extra marks, used for display.  These are not specified by the SGF
    // specification, but they are often useful.
    LASTMOVE: 19, // Should probably never be used, but is useful
    // It's useful to destinguish between standard TEXTLABELs and NEXTVARIATION
    // labels.
    NEXTVARIATION: 20
  },

  symbolFromEnum: function(value) {
    if (glift.bridge.flattener._reverseSymbol !== undefined) {
      return glift.bridge.flattener._reverseSymbol[value];
    }
    var reverse = {};
    var symb = glift.bridge.flattener.symbols;
    for (var key in glift.bridge.flattener.symbols) {
      reverse[symb[key]] = key;
    }
    glift.bridge.flattener._reverseSymbol = reverse;
    return glift.bridge.flattener._reverseSymbol[value];
  },

  /**
   * Flatten the combination of movetree, goban, cropping, and treepath into an
   * array (really a 2D array) of symbols, (a _Flattened object).
   *
   * Some notes about the parameters:
   *  - The goban is used for extracting all the inital stones.
   *  - The movetree is used for extracting:
   *    -> The marks
   *    -> The next moves
   *    -> The previous move
   *    -> subsequent stones, if a nextMovesTreepath is present.  These are
   *    given labels.
   *  - The boardRegion indicates how big to make the board (i.e., the 2D array)
   *
   * Optional parameters:
   *  - nextMovesTreepath.  Defaults to [].  This is typically only used for
   *    printed diagrams.
   *  - Cropping.  Defaults to nextMovesCropping
   */
  flatten: function(
      movetreeInitial,
      goban,
      boardRegion,
      showNextVariationsType,
      nextMovesTreepath,
      startingMoveNum) {
    var s = glift.bridge.flattener.symbols;
    var mt = movetreeInitial.newTreeRef();
    var showVars = showNextVariationsType || glift.enums.showVariations.NEVER;
    var nmtp = nextMovesTreepath || [];
    if (glift.util.typeOf(nmtp) !== 'array') {
      nmtp = glift.rules.treepath.parseInitPosition(nmtp);
    }
    var mvNum = startingMoveNum || 1;
    var boardRegion = boardRegion || glift.enums.boardRegions.ALL;
    if (boardRegion === glift.enums.boardRegions.AUTO) {
      boardRegion = glift.bridge.getCropFromMovetree(mt);
    }
    var cropping = glift.displays.cropbox.getFromRegion(
        boardRegion, mt.getIntersections());

    // Map of ptString
    var stoneMap = glift.bridge.flattener._stoneMap(goban);
    // Map of ptString
    var labels = {};
    // Array of moves, augmented with labels where the collisions happened, so
    // that users can say things. 5 at 3.
    // i.e.,
    // {
    //  point: <point>,
    //  color: <color>,
    //  label: <label>,
    //  collision: {
    //    point: <point>,
    //    color: <color>,
    //    label: <label>
    //  }
    // }
    var collisions = [];
    // Only for reference.  Map of point to mark.
    var marks = {};

    // Apply the treepath to the movetree.
    // Move this to another function.
    // The extra labels bit is quite a hack.
    var extraLabels = 'abcdefghijklmnopqrstuvwxyz';
    var extraIdx = 0
    for (var i = 0; i < nmtp.length && mt.node().numChildren() > 0; i++) {
      mt.moveDown(nmtp[i]);
      // move is of the form {point: <pt>, color: <color>}.  Point is absent if
      // move is a pass.
      var move = mt.properties().getMove();
      if (move !== glift.util.none && move.point && move.color) {
        var ptString = move.point.toString();
        if (stoneMap[ptString] !== undefined) {
          // The only reason why we should see collisions would because we
          // placed a stone somwhere in this loop.
          var label = labels[ptString];
          var cmove = stoneMap[ptString]
          if (label === undefined) {
            // This can happen after multi-stone captures.  In this case, we
            // create a new label, for convenience.
            move.collision = cmove;
            labels[ptString] = extraLabels.charAt(extraIdx);
            marks[ptString] = s.TEXTLABEL;
            extraIdx++;
          } else {
            move.collision = cmove;
            move.label = "" + mvNum;
          }
          move.moveNum = mvNum;
          collisions.push(move);
        } else {
          stoneMap[ptString] = move;
          labels[ptString] = "" + mvNum;
          marks[ptString] = s.TEXTLABEL;
        }
      }
      mvNum += 1;
    }

    var mksOut = glift.bridge.flattener._markMap(mt);
    for (var l in mksOut.labels) {
      labels[l] = mksOut.labels[l];
    }
    for (var m in mksOut.marks) {
      marks[m] = mksOut.marks[m];
    }

    var sv = glift.enums.showVariations
    if (showVars === sv.ALWAYS ||
        (showVars === sv.MORE_THAN_ONE && mt.node().numChildren() > 1)) {
      for (var i = 0; i < mt.node().numChildren(); i++) {
        var move = mt.node().getChild(i).properties().getMove();
        if (move && move.point) {
          var pt = move.point;
          var ptStr = pt.toString();
          if (labels[ptStr] === undefined) {
            labels[ptStr] = "" + (i + 1);
          }
          marks[ptStr] = s.NEXTVARIATION;
        }
      }
    }

    // Finally! Generate the symbols array.
    var symbolPairs = glift.bridge.flattener._generateSymbolArr(
        cropping, stoneMap, marks, mt.getIntersections());

    var comment = mt.properties().getComment();
    if (comment === glift.util.none || comment === undefined) { comment = ""; }
    return new glift.bridge._Flattened(
        symbolPairs, labels, collisions, comment, boardRegion, cropping);
  },

  /**
   * Get map from pt string to stone {point: <point>, color: <color>}.
   */
  _stoneMap: function(goban) {
    var out = {};
    // Array of {color: <color>, point: <point>}
    var gobanStones = goban.getAllPlacedStones();
    for (var i = 0; i < gobanStones.length; i++) {
      var stone = gobanStones[i];
      out[stone.point.toString()] = stone;
    }
    return out;
  },

  /**
   * Get the relevant marks.  Returns an object containing two fields: marks,
   * which is a map from ptString to Symbol ID. and labels, which is a map
   * from ptString to text label.
   *
   * If there are two marks on the same intersection specified, the behavior is
   * undefined.  Either mark might succeed in being placed.
   *
   * Example
   * {
   *  marks: {
   *    "12.5": 13
   *    "12.3": 23
   *  }
   *  labels: {
   *    "12,3": "A"
   *    "12,4": "B"
   *  }
   * }
   */
  _markMap: function(movetree) {
    var s = glift.bridge.flattener.symbols;
    var propertiesToSymbols = {
      CR: s.CIRCLE,
      LB: s.TEXTLABEL,
      MA: s.XMARK,
      SQ: s.SQUARE,
      TR: s.TRIANGLE
    };
    var out = { marks: {}, labels: {} };
    for (var prop in propertiesToSymbols) {
      var symbol = propertiesToSymbols[prop];
      if (movetree.properties().contains(prop)) {
        var data = movetree.properties().getAllValues(prop);
        for (var i = 0; i < data.length; i++) {
          if (prop === glift.sgf.allProperties.LB) {
            var lblPt = glift.sgf.convertFromLabelData(data[i]);
            var key = lblPt.point.toString();
            out.marks[key] = symbol;
            out.labels[key] = lblPt.value;
          } else {
            var pt = glift.util.pointFromSgfCoord(data[i]);
            out.marks[pt.toString()] = symbol;
          }
        }
      }
    }
    return out;
  },

  /**
   * Returns:
   *  [
   *    [
   *      {base: 3, mark: 20},
   *      ...
   *    ],
   *    [...],
   *    ...
   * ]
   *
   */
  _generateSymbolArr: function(cropping, stoneMap, marks, ints) {
    var cb = cropping.cbox();
    var point = glift.util.point;
    var symbols = [];
    for (var y = cb.top(); y <= cb.bottom(); y++) {
      var row = [];
      for (var x = cb.left(); x <= cb.right(); x++) {
        var pt = point(x, y);
        var ptStr = pt.toString();
        var stone = stoneMap[ptStr];
        var mark = marks[ptStr];
        row.push(this._getSymbolPair(pt, stone, mark, ints));
      }
      symbols.push(row);
    }
    return symbols;
  },

  /**
   * pt: Point of interest.
   * stone: {point: <point>, color: <color>} or undefined,
   */
  _getSymbolPair: function(pt, stone, mark, intersections) {
    var s = glift.bridge.flattener.symbols;
    var BLACK = glift.enums.states.BLACK;
    var WHITE = glift.enums.states.WHITE;
    var EMPTY = glift.enums.states.EMPTY;
    var base = undefined;
    var outMark = s.EMPTY;
    if (mark !== undefined) {
      var color = EMPTY
      if (stone !== undefined) { color = stone.color; }
      switch(mark) {
        case s.TRIANGLE: outMark = s.TRIANGLE; break;
        case s.SQUARE: outMark = s.SQUARE; break;
        case s.CIRCLE: outMark = s.CIRCLE; break;
        case s.XMARK: outMark = s.XMARK; break;
        case s.LASTMOVE: outMark = s.LASTMOVE; break;
        case s.TEXTLABEL:
          outMark = s.TEXTLABEL;
          if (color === EMPTY) {
            base = s.EMPTY;
          }
          break;
        case s.NEXTVARIATION:
          outMark = s.NEXTVARIATION;
          if (color === EMPTY) {
            base = s.EMPTY;
          }
          break;
      }
    }
    var ints = intersections - 1;
    if (base === s.EMPTY) {
      // Do nothing.
    } else if (stone !== undefined && stone.color === BLACK) {
      base = s.BSTONE;
    } else if (stone !== undefined && stone.color === WHITE) {
      base = s.WSTONE;
    } else if (pt.x() === 0 && pt.y() === 0) {
      base = s.TL_CORNER;
    } else if (pt.x() === 0 && pt.y() === ints) {
      base = s.BL_CORNER;
    } else if (pt.x() === ints && pt.y() === 0) {
      base = s.TR_CORNER;
    } else if (pt.x() === ints && pt.y() === ints) {
      base = s.BR_CORNER;
    } else if (pt.y() === 0) {
      base = s.TOP_EDGE;
    } else if (pt.x() === 0) {
      base = s.LEFT_EDGE;
    } else if (pt.x() === ints) {
      base = s.RIGHT_EDGE;
    } else if (pt.y() === ints) {
      base = s.BOT_EDGE;
    } else if (this._isStarpoint(pt, intersections)) {
      base = s.CENTER_STARPOINT;
    } else {
      base = s.CENTER;
    }
    return {base: base, mark: outMark};
  },

  _starPointSets: {
    9 : [{2:true, 6:true}, {4:true}],
    13 : [{3:true, 9:true}, {6:true}],
    19 : [{3:true, 9:true, 15:true}]
  },

  /**
   * Determine whether a pt is a starpoint.  Intersections is 1-indexed, but the
   * pt is 0-indexed.
   */
  _isStarpoint: function(pt, intersections) {
    var starPointSets = glift.bridge.flattener._starPointSets[intersections];
    for (var i = 0; i < starPointSets.length; i++) {
      var set = starPointSets[i];
      if (set[pt.x()] && set[pt.y()]) {
        return true;
      }
    }
    return false;
  }
};

/**
 * Data used to populate either a display or diagram.
 */
glift.bridge._Flattened = function(
    symbolPairs, lblData, coll, comment, boardRegion, cropping) {
  // Dense two level array designating what the base layer of the board looks like.
  // Example:
  //  [
  //    [
  //      {mark: EMPTY, base: TR_CORNER},
  //      {mark: EMPTY, base: BSTONE},
  //      {mark: TRIANGLE, base: WSTONE},
  //      ...
  //    ], [
  //      ...
  //    ]
  //    ...
  //  ]
  this.symbolPairs = symbolPairs;

  // Map from ptstring to label data.
  // Example:
  //  {
  //    "12,3": "A",
  //    ...
  //  }
  this.labelData = lblData;

  // Collisions.  In other words, we record stones that couldn't be placed on
  // the board, if
  this.collisions = coll;

  // Comment string.
  // Example:
  //  Black to move and make life.
  this.comment = comment;

  // The board region this flattened representation is meant to display.
  this.boardRegion = boardRegion;

  // The cropping object.
  this.cropping = cropping;
};

glift.bridge._Flattened.prototype = {
  /**
   * Provide a SGF Point (intersection-point) and retrieve the relevant symbol.
   * Note, this uses the SGF indexing as opposed to the indexing in the array,
   * so if the cropping is provided
   */
  getSymbolPairIntPt: function(pt) {
    var row = this.symbolPairs[pt.y() - this.cropping.cbox().top()];
    if (row === undefined) { return row; }
    return row[pt.x() - this.cropping.cbox().left()];
  },

  /**
   * Get a symbol from a the symbol pair table.
   */
  getSymbolPair: function(pt) {
    var row = this.symbolPairs[pt.y()];
    if (row === undefined) { return row; }
    return row[pt.x()];
  },

  /**
   * Get a Int pt Label Point, using an integer point.
   */
  getLabelIntPt: function(pt) {
    return this.labelData[pt.toString()];
  },

  /*
   * Get a Int pt Label Point
   */
  getLabel: function(pt) {
    return this.getLabelIntPt(this.ptToIntpt(pt));
  },

  /**
   * Turn a 0 indexed pt to an intersection point.
   */
  ptToIntpt: function(pt) {
    return glift.util.point(
        pt.x() + this.cropping.cbox().left(),
        pt.y() + this.cropping.cbox().top());
  }
};