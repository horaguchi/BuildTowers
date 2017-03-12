var BuildTowers = function () {
  var screen = this.screen = [];
  for (var y = 0; y < 25; ++y) { // status line is 2
    var row = [];
    for (var x = 0; x < 96; ++x) {
      row.push(' ');
    }
    screen.push(row);
  }
  this.rangeMatrix = screen.map(function (row) {
    return row.map(function (value) {
      return false; // no tower at start
    });
  });

  this.message = BuildTowers_MANUAL_LINE_STR;

  this.x = 48;
  this.y = 13;

  this.wave = 0;
  this.time = 0;

  this.status = {};
  this.status.gold = 10;
  this.status.wallPrice = 1;
  this.status.towerPrice = 10;
  this.status.health = 20;
  this.status.healthMax = 20;
  this.status.moveSpeed = 2;
  this.status.moveCD = 0;

  this.status.power = 10;
  this.status.fireSpeed = 4;
  this.status.fireCD = 0;
  this.status.range = 3;

  this.enemies = [];
  this.towers = [];

  this.finder = new PF.AStarFinder({
    heuristic: PF.Heuristic.euclidean,
    diagonalMovement: PF.DiagonalMovement.Never
  });
  this.createPoints();
  this.path = [];
  this.calculatePath();
};
// for node.js, not for CommonJS
module.exports = BuildTowers;

var BuildTowers_EMPTY_LINE_STR = '                                                                                                ';
var BuildTowers_MANUAL_LINE_STR = 'WASD or HJKL - move, Q - build wall(1G), E - build tower(5G)';
var BuildTowers_MONEY_SHORT_LINE_STR = 'You do not have enough money.'
var BuildTowers_CANNOT_BUILD_TOWER_LINE_STR = 'You can\'t build a tower here.';
var BuildTowers_CANNOT_BUILD_WALL_LINE_STR = 'You can\'t build a wall here.';
var PF = require('pathfinding');

BuildTowers.prototype.getScreen = function () {
  var status = this.status;
  var px = this.x, py = this.y;
  var time = this.time;
  var status_str = 'WAVE:' + this.wave + ' TIME:' + Math.floor(time / 10) + ' HP:' + status.health + '/' + status.healthMax;
  status_str += ' GLD:' + status.gold + '(#:' + status.wallPrice + ',@:' + status.towerPrice + ')';
  var weapon_str = 'POW:' + status.power + ' SPD:' + status.fireSpeed + ' RNG:' + status.range;
  status_str += (BuildTowers_EMPTY_LINE_STR + weapon_str).slice(status_str.length - 96);
  var enemiesMap = {};
  this.enemies.forEach(function (enemy) {
    enemiesMap[enemy.x + '-' + enemy.y] = enemy.type;
  });
  var rangeMatrix = this.rangeMatrix;
  return [ status_str.split(''), (this.message + BuildTowers_EMPTY_LINE_STR).split('') ].concat(this.screen.map(function (row, y) {
    return row.map(function (tile, x) {
      var screen_str = enemiesMap[x + '-' + y] || (rangeMatrix[y][x] && tile === ' ' ? '.' : tile);
      if (px == x && py == y) {
        return '{underline}' + screen_str + '{/underline}';
      }
      return screen_str;
    });
  }));
};

BuildTowers.prototype.key = function (key_str) {
  if (this.status.health < 0) {
    this.message = '*GAME OVER*';
    return true;
  }

  if (key_str === 'w' || key_str === 'k' || key_str === '&') {
    return this.moveCursor(0, -1);
  } else if (key_str === 'a' || key_str === 'h' || key_str === '%') {
    return this.moveCursor(-1, 0);
  } else if (key_str === 's' || key_str === 'j' || key_str === '(') {
    return this.moveCursor(0, 1);
  } else if (key_str === 'd' || key_str === 'l' || key_str === "'") {
    return this.moveCursor(1, 0);
  } else if (key_str === 'q') {
    return this.buildWall();
  } else if (key_str === 'e') {
    return this.buildTower();
  }

  return true;
};

BuildTowers.prototype.turn = function () {
  if (this.status.health < 0) {
    return true;
  }

  if (this.time % 1000 === 0) {
    this.wave++;
    this.spawnRate = Math.max(30 - this.wave, 0) + 4 + Math.ceil(Math.random() * 20);
    this.spawnSeed = Math.random();
  } else if (this.time % 1000 < 800) {
    if (this.time % this.spawnRate === 0) {
      this.createEnemy(this.spawnSeed);
    }
  }

  this.enemies = this.enemies.filter(function (enemy) {
    if (!enemy.dead) {
      this.enemyMove(enemy);
      return true;
    }
  }, this);

  this.towers.forEach(function (tower) {
    this.towerFire(tower);
  }, this);

  this.time++;
  return true;
};

BuildTowers.prototype.createPoints = function () {
  var points_num = Math.floor(Math.random() * 3) + 2; // 1 ~ 3
  var points = [ ];
  for (var i = 0; i < points_num; ++i) {
    var point = [ ];
    var point_ng = true;
    while (point_ng) {
      point = [ Math.floor(Math.random() * 96), Math.floor(Math.random() * 25) ];
      if (point[0] === 48 && point[1] === 13) { // < position
        continue;
      } else if (this.screen[point[1]][point[0]] !== ' ') {
        continue;
      }
      point_ng = false;
    }
    points.push(point);
    if (i === 0) {
      this.screen[point[1]][point[0]] = '>';
    } else {
      this.screen[point[1]][point[0]] = String(i);
    }
  }
  this.screen[13][48] = '<';
  points.push([ 48, 13 ]);
  this.points = points;
};

BuildTowers.prototype.calculatePath = function () {
  var screen = this.screen;
  var matrix = screen.map(function (row) {
    return row.map(function (value) {
      return /^[^1-9.,> ]$/.test(value);
    });
  });
  var grid = new PF.Grid(96, 25, matrix);
  var finder = this.finder;
  var points = this.points;
  var all_path = [];
  for (var i = 1; i < points.length; ++i) {
    if (i === points.length - 1) { // final @ is walkable
      grid.setWalkableAt(points[i][0], points[i][1], true);
    }
    var path = finder.findPath(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], grid.clone());
    if (path.length === 0) {
      return false; // path is blocking
    }
    path.pop();
    all_path = all_path.concat(path);
  }
  for (var i = 0; i < this.path.length; ++i) {
    var before_path = this.path[i];
    if (screen[before_path[1]][before_path[0]] === ',') {
      screen[before_path[1]][before_path[0]] = ' ';
    }
  }
  for (var i = 0; i < all_path.length; ++i) {
    var next_path = all_path[i];
    if (screen[next_path[1]][next_path[0]] === ' ') {
      screen[next_path[1]][next_path[0]] = ',';
    }
  }
  this.path = all_path;
  return true;
};

BuildTowers.prototype.moveCursor = function (move_x, move_y) {
  if (this.time <= this.status.moveCD) {
    return false;
  }
  var new_x = this.x + move_x, new_y = this.y + move_y;
  if (new_x < 0 || 96 <= new_x || new_y < 0 || 25 <= new_y) {
    this.message = 'Blocked';
    return false;
  }
  this.x = new_x; this.y = new_y;
  this.status.moveCD = this.time + this.status.moveSpeed;
  return true;
};

BuildTowers.prototype.buildWall = function () {
  var screen = this.screen;
  var cx = this.x, cy = this.y;
  if (screen[cy][cx] !== ' ' && screen[cy][cx] !== ',') {
    return false;
  } else if (this.status.gold < this.status.wallPrice) {
    this.message = BuildTowers_MONEY_SHORT_LINE_STR;
    return false;
  }
  var before_screen = screen[cy][cx];
  screen[cy][cx] = '#';
  if (!this.calculatePath()) {
    screen[cy][cx] = before_screen;
    this.message = BuildTowers_CANNOT_BUILD_WALL_LINE_STR;
    return false;
  }
  this.status.gold -= this.status.wallPrice;
  return true;
};

BuildTowers.prototype.buildTower = function () {
  var screen = this.screen;
  var cx = this.x, cy = this.y;
  if (screen[cy][cx] !== ' ' && screen[cy][cx] !== ',' && screen[cy][cx] !== '#') {
    return false;
  } else if (this.status.gold < this.status.towerPrice) {
    this.message = BuildTowers_MONEY_SHORT_LINE_STR;
    return false;
  }
  var before_screen = screen[cy][cx];
  screen[cy][cx] = '@';
  if (!this.calculatePath()) {
    screen[cy][cx] = before_screen;
    this.message = BuildTowers_CANNOT_BUILD_WALL_LINE_STR;
    return false;
  }
  this.towers.push({ x: cx, y: cy, status: { fireCD: 0 }});
  this.updateRangeMatrix();
  this.status.gold -= this.status.towerPrice;
  this.status.towerPrice++;
  return true;
};

BuildTowers.prototype.updateRangeMatrix = function () {
  var towers = this.towers;
  var range = this.status.range;
  this.rangeMatrix = this.screen.map(function (row, y) {
    return row.map(function (value, x) {
      return towers.some(function (tower) {
        return Math.abs(x - tower.x) + Math.abs(y - tower.y) <= range;
      });
    });
  });
};

BuildTowers.prototype.towerFire = function (tower) {
  if (this.time <= tower.status.fireCD) {
    return false;
  }
  var enemy = null;
  var tx = tower.x, ty = tower.y;
  var range = this.status.range;
  this.enemies.some(function (test_enemy) {
    var x = test_enemy.x, y = test_enemy.y;
    if (!test_enemy.dead && Math.abs(x - tx) + Math.abs(y - ty) <= range) {
      enemy = test_enemy;
      return true;
    }
  });
  if (!enemy) {
    return false;
  }
  tower.status.fireCD = this.time + this.status.fireSpeed;
  enemy.status.health -= this.status.power;
  if (enemy.status.health < 0) {
    enemy.dead = true;
    this.message = enemy.type + ' is killed.';
    this.status.gold++;
  }
};

BuildTowers.prototype.enemyMove = function (enemy) {
  if (this.time <= enemy.status.moveCD) {
    return false;
  }
  enemy.pathIndex++;
  if (enemy.pathIndex == this.path.length) {
    enemy.dead = true;
    this.status.health--;
    return false;
  }
  enemy.x = this.path[enemy.pathIndex][0]; enemy.y = this.path[enemy.pathIndex][1];
  enemy.status.moveCD = this.time + enemy.status.moveSpeed;
  return true;
};

var BuildTowers_WAVE_SCALE = 1;
BuildTowers.prototype.createEnemy = function (rand_num) {
  var enemy = {};
  enemy.x = this.path[0][0]; enemy.y = this.path[0][1];
  enemy.pathIndex = 0;

  enemy.type = 'Z';
  enemy.status = {};
  enemy.status.health = 10 * (BuildTowers_WAVE_SCALE + this.wave) / BuildTowers_WAVE_SCALE;
  enemy.status.healthMax = 10 * (BuildTowers_WAVE_SCALE + this.wave) / BuildTowers_WAVE_SCALE;
  enemy.status.moveSpeed = 2;
  enemy.status.moveCD = 0;
  if (rand_num < 0.01) {
    enemy.type = 'D';
    enemy.status.health = Math.ceil(enemy.status.health * 3);
    enemy.status.moveSpeed = 2;
  } else if (rand_num < 0.1) {
    enemy.type = 'V';
    enemy.status.health = Math.ceil(enemy.status.health * 1.4);
    enemy.status.moveSpeed = 2;
  } else if (rand_num < 0.25) {
    enemy.type = 'r';
    enemy.status.health = Math.ceil(enemy.status.health / 2);
    enemy.status.moveSpeed = 1;
  } else if (rand_num < 0.5) {
    enemy.type = 'T';
    enemy.status.health = Math.ceil(enemy.status.health * 2);
    enemy.status.moveSpeed = 4;
  } else if (rand_num < 0.75) {
    enemy.type = 'G';
    enemy.status.health = Math.ceil(enemy.status.health * 1.2);
    enemy.status.moveSpeed = 3;
  }

  this.enemies.push(enemy);
};

BuildTowers.prototype.point = function (x, y) {
  return true;
};

