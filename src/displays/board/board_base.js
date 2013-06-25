(function(){
// Create the base board background object and immediately call draw().
glift.displays.board.Display.prototype.createBoardBase = function() {
  return new BoardBase(this._paper, this._environment, this._theme.board)
    .draw();
};

var BoardBase = function(paper, environment, subtheme) {
  this.paper = paper;
  this.environment = environment;
  this.subtheme = subtheme;
  this.rect = glift.util.none // init'd with draw()
};

BoardBase.prototype = {
  draw: function() {
    var box = this.environment.goBoardBox;
    this.destroy(); // remove if it already exists.
    this.rect = this.paper.rect(
        box.topLeft().x(),
        box.topLeft().y(),
        box.width(),
        box.height());
    this.rect.attr(this.subtheme.boardAttr);
    return this;
  },

  redraw: function() {
    return this.draw();
  },

  destroy: function() {
    this.rect && this.rect !== glift.util.none && this.rect.remove();
    return this;
  }
};
})();