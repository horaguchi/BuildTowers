var BuildTowers = function () {
  var screen = this.screen = [];
  for (var y = 0; y < 25; ++y) { // status line is 2
    var row = [];
    for (var x = 0; x < 96; ++x) {
      row.push(' ');
    }
    screen.push(row);
  }
  var items = this.items = [];
  for (var y = 0; y < 25; ++y) { // status line is 2
    var item_row = [];
    for (var x = 0; x < 96; ++x) {
      item_row.push(false);
    }
    items.push(item_row);
  }
  this.message = BuildTowers_MANUAL_LINE_STR;

  this.x = 48;
  this.y = 13;
  screen[this.y][this.x] = '@';

  this.wave = 0;
  this.time = 0;

  this.status = {};
  this.status.health = 100;
  this.status.healthMax = 100;
  this.status.moveSpeed = 4;
  this.status.moveCD = 0;

  this.status.symbol = '/';
  this.status.power = 10;
  this.status.magazine = 10;
  this.status.capacity = 10;
  this.status.ammo = 100;
  this.status.fireSpeed = 4;
  this.status.fireCD = 0;
  this.status.reloadSpeed = 30;
  this.status.reloadCD = 0;
  this.status.rangeSpeed = 18;
  this.status.rangeMin = 3;
  this.status.rangeMax = 2;
  this.status.rangeType = 'B';

  this.enemies = [];
};
// for node.js, not for CommonJS
module.exports = BuildTowers;

var BuildTowers_EMPTY_LINE_STR = '                                                                                                ';
var BuildTowers_MANUAL_LINE_STR = 'WASD - move, A - build tower, X - remove tower, SPACE - next turn';
var PF = require('pathfinding');

BuildTowers.prototype.getScreen = function () {
  var status = this.status;
  var px = this.x, py = this.y;
  var time = this.time;
  var status_str = 'WAVE:' + this.wave + ' TIME:' + Math.floor(time / 10) + ' HP:' + status.health + '/' + status.healthMax + ' SPD:' + status.moveSpeed;
  var weapon_str = 'POW:' + status.power + ' CAP:' + status.magazine + '/' + status.capacity + '/' + status.ammo;
  weapon_str += ' SPD:' + status.fireSpeed + ' RLD:' + (time <= status.reloadCD ? status.reloadCD - time : status.reloadSpeed);
  weapon_str += ' RNG:' + status.rangeType + '/' + status.rangeSpeed + '/' + status.rangeMin + '+' + status.rangeMax;
  status_str += (BuildTowers_EMPTY_LINE_STR + weapon_str).slice(status_str.length - 96);
  var items = this.items;
  var range_num = status.rangeMin + Math.min(status.rangeMax, Math.floor(Math.max(0, (time - status.moveCD)) / status.rangeSpeed));
  var enemiesMap = {};
  this.enemies.forEach(function (enemy) {
    enemiesMap[enemy.x + '-' + enemy.y] = enemy.type;
  });
  return [ status_str.split(''), (this.message + BuildTowers_EMPTY_LINE_STR).split('') ].concat(this.screen.map(function (row, y) {
    return row.map(function (tile, x) {
      if (tile !== ' ') {
        return tile;
      } else if (enemiesMap[x + '-' + y]) {
        return enemiesMap[x + '-' + y];
      }
    });
  }));
};

BuildTowers.prototype.key = function (key_str) {
  if (this.status.health < 0) {
    return true;
  }

  if (key_str === 'w' || key_str === 'k' || key_str === '&') {
    return this.move(0, -1);
  } else if (key_str === 'a' || key_str === 'h' || key_str === '%') {
    return this.move(-1, 0);
  } else if (key_str === 's' || key_str === 'j' || key_str === '(') {
    return this.move(0, 1);
  } else if (key_str === 'd' || key_str === 'l' || key_str === "'") {
    return this.move(1, 0);
  } else if (key_str === 'f') {
    return this.fire();
  }

  return true;
};

BuildTowers.prototype.calculatePath = function () {
  var matrix = this.mapSymbol.map(function (row) {
    return row.map(function (value) {
      return /^[^1-9.>]$/.test(value);
    });
  });
  var grid = new PF.Grid(54, 27, matrix);
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
  var map_symbol = this.mapSymbol;
  var map_color = this.mapColor;
  for (var i = 0; i < this.path.length; ++i) {
    var before_path = this.path[i];
    if (map_symbol[before_path[1]][before_path[0]] === '.') {
      map_color[before_path[1]][before_path[0]] = 'gray';
    }
  }
  for (var i = 0; i < all_path.length; ++i) {
    var next_path = all_path[i];
    map_color[next_path[1]][next_path[0]] = 'yellow';
  }
  this.path = all_path;
  return true;
};


BuildTowers.prototype.move = function (move_x, move_y) {
  var new_x = this.x + move_x, new_y = this.y + move_y;
  if (this.time <= this.status.moveCD) {
    return false;
  } else if (new_x < 0 || 96 <= new_x || new_y < 0 || 25 <= new_y) {
    this.message = 'Blocked';
    return false;
  } else if (this.screen[new_y][new_x] !== ' ') {
    this.message = 'Blocked';
    return false;
  }
  this.screen[this.y][this.x] = ' ';
  this.screen[new_y][new_x] = '@';
  this.x = new_x; this.y = new_y;
  this.status.moveCD = this.time + this.status.moveSpeed;
  if (this.items[new_y][new_x]) {
    var status = this.items[new_y][new_x];
    if (status.symbol === '%') {
      var rand = Math.random();
      if (rand < 0.9) {
        this.message = "My, that's a yummy corpse. ";
        if (rand * 100 % 10 < 3) {
          this.message += "You feel better.";
          this.status.health = this.status.healthMax;
        } else if (rand * 100 % 10 < 6) {
          this.message += "You feel bigger.";
          this.status.healthMax = this.status.healthMax += 40;
        } else if (rand * 100 % 10 < 9) {
          this.message += "You seem faster.";
          this.status.moveSpeed = Math.max(0, this.status.moveSpeed - 1);
        } else if (rand * 100 % 10 < 10) {
          this.message += "A tail has been growing in your gun.";
          this.status.power += this.wave;
        }
      } else {
        this.message = 'The corpse tastes terrible! ';
        if (rand * 100 % 10 < 3) {
          this.message += "You feel smaller.";
          this.status.healthMax = Math.ceil(this.status.healthMax / 2);
          this.status.health = Math.min(this.status.healthMax, this.status.health);
        } else if (rand * 100 % 10 < 6) {
          this.message += "You seem slower.";
          this.status.moveSpeed += 2;
        } else if (rand * 100 % 10 < 9) {
          this.message += "You can not move for a while.";
          this.status.moveCD += 1000;
        } else if (rand * 100 % 10 < 10) {
          this.message += "Your health point become 1.";
          this.status.health = 1;
        }
      }
      this.items[new_y][new_x] = null;
    } else if (status.symbol === '!') {
      this.message = 'You pick up ammo.';
      this.status.ammo += Math.ceil( 1 + Math.random() * 10 );
      this.items[new_y][new_x] = null;
    } else {
      var message = 'E - equip --> ';
      var weapon_str = 'POW:' + status.power + ' CAP:' + status.magazine + '/' + status.capacity + '/**' ;
      weapon_str += ' SPD:' + status.fireSpeed + ' RLD:' + status.reloadSpeed;
      weapon_str += ' RNG:' + status.rangeType + '/' + status.rangeSpeed + '/' + status.rangeMin + '+' + status.rangeMax;
      message += (BuildTowers_EMPTY_LINE_STR + weapon_str).slice(message.length - 96);
      this.message = message;
    }
  } else {
    //this.message = '';
  }
  return true;
};

BuildTowers.prototype.enemyMove = function (enemy) {
  if (this.time <= enemy.status.moveCD) {
    return false;
  }
  var x_abs = Math.abs(this.x - enemy.x);
  var y_abs = Math.abs(this.y - enemy.y);
  if (x_abs === 0 && y_abs === 1) {
    return false;
  } else if (x_abs === 1 && y_abs === 0) {
    return false;
  }
  var new_x = this.x < enemy.x ? enemy.x - 1 : enemy.x + 1;
  var new_y = this.y < enemy.y ? enemy.y - 1 : enemy.y + 1;
  if (this.screen[new_y][enemy.x] !== ' ' && this.screen[enemy.y][new_x] !== ' ') {
    return false;
  } else if (this.screen[new_y][enemy.x] === ' ' && this.screen[enemy.y][new_x] !== ' ') {
    new_x = enemy.x;
  } else if (this.screen[new_y][enemy.x] !== ' ' && this.screen[enemy.y][new_x] === ' ') {
    new_y = enemy.y;
  } else if (x_abs === y_abs) {
    if (Math.random() < 0.5) {
      new_x = enemy.x;
    } else {
      new_y = enemy.y;
    }
  } else if (x_abs < y_abs) {
    new_x = enemy.x;
  } else {
    new_y = enemy.y;
  }
  //this.screen[enemy.y][enemy.x] = ' ';
  //this.screen[new_y][new_x] = enemy.type;
  enemy.x = new_x; enemy.y = new_y;
  enemy.status.moveCD = this.time + enemy.status.moveSpeed;
  return true;
};

BuildTowers.prototype.fire = function () {
  if (this.time <= this.status.fireCD) {
    return false;
  } else if (this.status.magazine === 0) {
    this.message = 'You need to reload.';
    return false;
  } else if (this.time <= this.status.reloadCD) {
    this.message = "You are reloading.";
    return false;
  }
  var status = this.status;

  var enemy = null;
  var px = this.x, py = this.y;
  var range_num = status.rangeMin + Math.min(status.rangeMax, Math.floor(Math.max(0, (this.time - status.moveCD)) / status.rangeSpeed));
  this.enemies.some(function (test_enemy) {
    var x = test_enemy.x, y = test_enemy.y;
    if (status.rangeType === 'A' && Math.abs(x - px) + Math.abs(y - py) < range_num) {
      enemy = test_enemy;
      return true;
    } else if (status.rangeType === 'B' && (x - px) * (x - px) + (y - py) * (y - py) < range_num * range_num) {
      enemy = test_enemy;
      return true;
    } else if (status.rangeType === 'C' && (Math.abs(x - px) || 0.5) * (Math.abs(y - py) || 0.5)  < range_num) {
      enemy = test_enemy;
      return true;
    }
  });

  this.status.magazine--;
  this.status.fireCD = this.time + this.status.fireSpeed;

  var magazine_str = '[';
  for (var i = 0; i < this.status.capacity; ++i) {
    magazine_str += i < this.status.magazine ? '*' : '-';
  }
  this.message = magazine_str + '] ';
  if (enemy) {
    enemy.status.health -= status.power;
    if (enemy.status.health < 0) {
      enemy.dead = true;
      this.screen[enemy.y][enemy.x] = ' ';
      if (!this.items[enemy.y][enemy.x]) {
        var rand = Math.random();
        if (rand < 0.4) {
          this.items[enemy.y][enemy.x] = { 'symbol': '%' };
        } else if (rand < 0.7) {
          this.items[enemy.y][enemy.x] = { 'symbol': '!' };
        } else if (rand < 0.9) {
          this.items[enemy.y][enemy.x] = BuildTowers.getWeaponFromStatus(enemy.status);
        }
      }
    }
    this.message += 'You shooted an enemy.';
  } else {
    this.message += 'It did not hit.';
  }
  return true;
};

BuildTowers.getWeaponFromStatus = function (status) {
  var weapon = {};
  weapon.symbol      = status.symbol;
  weapon.power       = status.power;
  weapon.magazine    = status.magazine;
  weapon.capacity    = status.capacity;
  weapon.fireSpeed   = status.fireSpeed;
  weapon.reloadSpeed = status.reloadSpeed;
  weapon.rangeSpeed  = status.rangeSpeed;
  weapon.rangeMin    = status.rangeMin;
  weapon.rangeMax    = status.rangeMax;
  weapon.rangeType   = status.rangeType;
  return weapon;
};

BuildTowers.setWeaponToStatus = function (status, weapon) {
  status.symbol      = weapon.symbol;
  status.power       = weapon.power;
  status.magazine    = weapon.magazine;
  status.capacity    = weapon.capacity;
  status.fireSpeed   = weapon.fireSpeed;
  status.reloadSpeed = weapon.reloadSpeed;
  status.rangeSpeed  = weapon.rangeSpeed;
  status.rangeMin    = weapon.rangeMin;
  status.rangeMax    = weapon.rangeMax;
  status.rangeType   = weapon.rangeType;
  return status;
};

BuildTowers.prototype.turn = function () {
  if (this.status.health < 0) {
    return true;
  }

  if (this.time % 1000 === 0) {
    this.wave++;
    this.spawnRate = 50 + Math.ceil(Math.random() * 50);
    this.spawnSeed = Math.random();
  } else if (this.time % 1000 < 500) {
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
  this.time++;
  return true;
};

var BuildTowers_WAVE_SCALE = 4;
BuildTowers.prototype.createEnemy = function (rand_num) {
  var enemy = {};
  if (rand_num * 100 % 4 < 1) {
    enemy.x = 0; enemy.y = 0;
  } else if (rand_num * 100 % 4 < 2) {
    enemy.x = 95; enemy.y = 0;
  } else if (rand_num * 100 % 4 < 3) {
    enemy.x = 0; enemy.y = 24;
  } else if (rand_num * 100 % 4 < 4) {
    enemy.x = 95; enemy.y = 24;
  }
  enemy.type = 'Z';
  enemy.status = {};
  enemy.status.health = 10 * (BuildTowers_WAVE_SCALE + this.wave) / BuildTowers_WAVE_SCALE;
  enemy.status.healthMax = 10 * (BuildTowers_WAVE_SCALE + this.wave) / BuildTowers_WAVE_SCALE;
  enemy.status.moveSpeed = 10;
  enemy.status.moveCD = 0;
  if (rand_num < 0.01) {
    enemy.type = 'D';
    enemy.status.health = Math.ceil(enemy.status.health * 3);
    enemy.status.moveSpeed = 6;
  } else if (rand_num < 0.1) {
    enemy.type = 'V';
    enemy.status.health = Math.ceil(enemy.status.health * 1.4);
    enemy.status.moveSpeed = 8;
  } else if (rand_num < 0.25) {
    enemy.type = 'r';
    enemy.status.health = Math.ceil(enemy.status.health / 2);
    enemy.status.moveSpeed = 4;
  } else if (rand_num < 0.5) {
    enemy.type = 'T';
    enemy.status.health = Math.ceil(enemy.status.health * 2);
    enemy.status.moveSpeed = 16;
  } else if (rand_num < 0.75) {
    enemy.type = 'G';
    enemy.status.health = Math.ceil(enemy.status.health * 1.2);
    enemy.status.moveSpeed = 12;
  }

  if (this.screen[enemy.y][enemy.x] === ' ') {
    this.enemies.push(enemy);
    //this.screen[enemy.y][enemy.x] = enemy.type;
  }
};

BuildTowers.prototype.point = function (x, y) {
  return true;
};

