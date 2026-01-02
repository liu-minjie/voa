var keycode_F1 = 112,
	keycode_F2 = 113,
	keycode_F3 = 114,
	keycode_F4 = 115,
	keycode_F5 = 116,
	keycode_F6 = 117,
	keycode_F7 = 118,
	keycode_F8 = 119,
	keycode_F9 = 120,
	keycode_F10 = 121,
	keycode_F11 = 122,
	keycode_F12 = 123,
	_keycode = 0;
var is_editWin_show = false;
var is_txt_show = false;
var is_lrc_show = false;
var txtHeight;
var lrcHeight;
var playtcTimer = 0;
var tcIndex = 0;
var tcLength = 0;
var cntR_tc = 3;
var tcMode;
var is_R_tc = false;
var tcFrom;
var tcTo;
var nowShow = "lrc";
var timer_R_tc = 0;
var Player = {
	obja: null,
	objv: null,
	obj: null,
	state: 0,
	state2: 0,
	is_playing: false,
	is_X_moving: false,
	rate: 1,
	rate0: 1,
	ratemin: 0.5,
	ratemax: 3,
	R_time_wait: 0,
	R_time_wait_drag: 0,
	is_bntP_down: false,
	is_btnP_moving: false,
	r_cnt0: 0,
	r_cnt: 0,
	r_cnt_tmp: 0,
	r_cnt_now: 0,
	R_time: 5,
	is_R: false,
	is_R_stop: false,
	is_R_tc: false,
	is_btnR_down: false,
	is_btnR_moving: false,
	timer_R: -1,
	dotA: 0,
	dotA_old: 0,
	dotA_wy: 0,
	is_A: false,
	is_btnA_down: false,
	is_btnA_moving: false,
	dotB: 0,
	dotB_old: 0,
	dotB_wy: 0,
	is_B: false,
	is_btnB_down: false,
	is_btnB_moving: false,
	is_labelA_show: false,
	is_labelB_show: false,
	labelA_x: 0,
	labelB_x: 0,
	play_list: [],
	current_index: -1,
	is_mp3: false,
	is_mp4: false,
	is_slider_dragging: false,
	is_touch: false,
	is_single: false,
	is_single_loop: false,
	is_multi_loop: true,
	is_sync: false,
	syncTimer: 0,
	btnBorderColor: "",
	clear_list: function() {
		this.play_list.length = 0;
		this.current_index = -1;
	},
	is_empty_play_list: function() {
		return this.play_list.length == 0;
	},
	setobj: function(a) {
		this.obj = document.getElementById(a);
	},
	sync: function(a) {
		return;
		if (a == 0) {
			clearInterval(this.syncTimer);
			this.is_sync = false;
			return;
		}
		if (a != 0 && this.is_sync) {
			return;
		}
		this.syncTimer = setInterval(function() {
			if (Player.obj.readyState == 4) {
				var b = Player.obj.currentTime / Player.obj.duration * Player.sliderWidth();
				if (typeof(b) == "NaN") {
					b = 0;
				}
				$("#slider-play").width(b);
			}
			if (Player.obj.duration > 0) {
				Player.dispMS();
			}
		}, 50);
		this.is_sync = true;
	},
	ch: function() {
		var b = $("#playerblock");
		var a = $("#playerwrap");
		var c = setInterval(function() {
			b.height(a.outerHeight());
		}, 500);
		return c;
	},
	setPlayerRate: function(a) {
		Player.rate = a;
		$("#btnX").text(a);
	},
	play: function() {
		if (arguments.length == 0) {
			this.obj.play();
			this.obj.playbackRate = Player.rate;
		}
		this.state = 1;
		this.state2 = 1;
		$("#btnPlay").css("background-image", "url(/public/webr8/img/pause.png)");
	},
	playAB: function() {
		this.pause();
		this.startplayAB();
		this.is_R = true;
		this.btnR_on();
	},
	startplayAB: function() {
		Player.obj.currentTime = Player.dotA;
		clearInterval(Player.timer_R);
		Player.listeningAB();
		Player.play();
	},
	listeningAB: function() {
		var a = false;
		Player.timer_R = setInterval(function() {
			if (!a) {
				$("#btnR").text(Player.r_cnt > 0 ? (Player.r_cnt_now + 1) + "/" + Player.r_cnt0 : "");
				a = true;
			}
			if (Player.is_R_stop) {
				clearInterval(Player.timer_R);
				Player.is_R_stop = false;
				Player.is_R = false;
				Player.btnR_off();
				$("#btnR").text(Player.r_cnt > 0 ? Player.r_cnt : "");
			} else {
				if (Player.obj.currentTime > Player.dotB) {
					if (Player.r_cnt0 != 0) {
						Player.r_cnt_now++;
						a = false;
					}
					if (Player.r_cnt_now >= Player.r_cnt && Player.r_cnt0) {
						Player.cancelAB();
						Player.is_R_stop = true;
						Player.r_cnt_now = 0;
					} else {
						Player.pause();
						Player.obj.currentTime = Player.dotB;
						clearInterval(Player.timer_R);
						setTimeout(Player.startplayAB, Player.R_time_wait);
					}
				}
			}
		}, 100);
	},
	cancelAB: function() {
		this.is_R_stop = true;
	},
	pause: function() {
		if (arguments.length == 0) {
			this.obj.pause();
		}
		this.state = 2;
		$("#btnPlay").css("background-image", "url(/public/webr8/img/play.png)");
	},
	stop: function() {
		Player.obj.currentTime = 0;
		Player.obj.pause();
		Player.state = 0;
		Player.state2 = 0;
		$("#slider-play").width(0);
		$("#btnPlay").css("background-image", "url(/public/webr8/img/play.png)");
		if (lrc) {
			clearTCTimer(true);
			this.obj.playbackRate = this.rate;
			$("#btnR").text(Player.r_cnt0 ? Player.r_cnt0 : "");
		}
	},
	btnR_on: function() {
		$("#btnR").css("background-color", "#ffee00");
	},
	btnR_off: function() {
		$("#btnR").css("background-color", "");
	},
	btnA_on: function() {
		$("#btnA").css("background-color", "#ffea00");
		this.is_A = true;
	},
	btnA_off: function() {
		$("#btnA").css("background-color", "#f1f1f1");
		this.is_A = false;
	},
	btnB_on: function() {
		$("#btnB").css("background-color", "#ffea00");
		this.is_B = true;
	},
	btnB_off: function() {
		$("#btnB").css("background-color", "#f1f1f1");
		this.is_B = false;
	},
	btnPlay_click: function() {
		if (Player.state == 0 || Player.state == 2) {
			Player.play();
			Player.state2 = 1;
		} else {
			if (Player.state == 1) {
				Player.pause();
				Player.state2 = 2;
			}
		}
	},
	btnStop_click: function() {
		this.btnC_click();
		Player.stop();
		Player.state2 = 2;
		clearTCTimer(true);
	},
	btnBf_click: function(b) {
		var a;
		if (b.ctrlKey) {
			a = Player.obj.currentTime - 10;
		} else {
			a = Player.obj.currentTime - 3;
		}
		if (a < 0) {
			a = 0;
		}
		Player.obj.currentTime = a;
	},
	btnBf_longclick: function() {
		if (Player.is_labelA_show && Player.is_labelB_show) {
			var d = Player.dotA,
				a = Player.dotB - d,
				e;
			Player.dotB = d;
			e = d - a;
			if (e < 0) {
				e = 0;
			}
			Player.dotA = e;
			Player.labelA_set(e);
			Player.labelB_set(d);
		}
	},
	btnFf_click: function(b) {
		var a;
		if (b.ctrlKey) {
			a = Player.obj.currentTime + 10;
		} else {
			a = Player.obj.currentTime + 3;
		}
		if (a > Player.obj.duration) {
			a = Player.obj.duration;
		}
		Player.obj.currentTime = a;
	},
	btnFf_longclick: function() {
		if (Player.is_labelA_show && Player.is_labelB_show) {
			var d = Player.dotB,
				a = d - Player.dotA,
				e;
			Player.dotA = d;
			e = d + a;
			if (e > Player.obj.duration) {
				e = Player.obj.duration;
			}
			Player.dotB = e;
			Player.labelA_set(d);
			Player.labelB_set(e);
		}
	},
	btnP_click: function(a) {
		Player.R_time_wait = 0;
		$("#btnP").text(Player.R_time_wait > 0 ? x : "");
	},
	btnR_click: function(b) {
		if (!this.is_R) {
			var a = Player.obj.currentTime;
			if (a < 0.5) {
				a = Player.obj.currentTime = 0.5;
			}
			Player.btnC_click();
			this.btnB_set(a);
			a -= Player.R_time;
			if (a < 0) {
				a = 0;
			}
			this.btnA_set(a);
			clearTCTimer();
		} else {
			Player.cancelAB();
		}
	},
	btnR_dragging: function(b) {
		b.preventDefault();
		var a = b.pageX,
			c = b.pageY;
	},
	btnA_click: function(a) {
		Player.btnA_set(Player.obj.currentTime);
	},
	btnA_set: function(a) {
		Player.labelA_set(a);
		if (Player.is_labelB_show) {
			checkAB();
			Player.playAB();
		}
	},
	labelA_set: function(b) {
		Player.dotA = b;
		var a = Player.labelA_x = b / Player.obj.duration * Player.sliderWidth();
		$("#lblA").css("left", a);
		Player.lblA_show();
	},
	btnB_click: function(a) {
		Player.btnB_set(Player.obj.currentTime);
	},
	btnB_set: function(a) {
		Player.labelB_set(a);
		if (Player.is_labelA_show) {
			checkAB();
			Player.playAB();
		}
	},
	labelB_set: function(b) {
		Player.dotB = b;
		var a = Player.labelB_x = b / Player.obj.duration * Player.sliderWidth();
		$("#lblB").css("left", a + 10);
		Player.lblB_show();
	},
	btnC_click: function() {
		Player.lbl_hide();
		if (Player.is_R) {
			Player.cancelAB();
		}
	},
	lblA_show: function() {
		$("#lblA").css("display", "block");
		this.is_labelA_show = true;
	},
	lblA_hide: function() {
		$("#lblA").css("display", "none");
		this.is_labelA_show = false;
	},
	lblB_show: function() {
		$("#lblB").css("display", "block");
		this.is_labelB_show = true;
	},
	lblB_hide: function() {
		$("#lblB").css("display", "none");
		this.is_labelB_show = false;
	},
	lbl_show: function() {
		this.lblA_show();
		this.lblB_show();
	},
	lbl_hide: function() {
		this.lblA_hide();
		this.lblB_hide();
	},
	bindBtns: function() {
		$("#btns button").on("mousedown touchstart", b);

		function b(f) {
			f.preventDefault();
			var g = f.target;
			$(g).css("border", "3px solid #999");
			$(g).on("mouseup mouseleave touchend", c);
		}

		function c(f) {
			f.preventDefault();
			var g = f.target;
			$(g).css("border", "3px solid " + Player.btnBorderColor);
			$(g).off("mouseup mouseleave touchend", c);
			$(this).blur();
		}
		$("#btnPlay").on("click touchend", function(f) {
			f.preventDefault();
			Player.btnPlay_click(f);
			this.blur();
		});
		$("#btnStop").on("click touchend", function(f) {
			f.preventDefault();
			Player.btnStop_click(f);
			this.blur();
		});

		function d(g) {
			var h, f = false;
			g.on("mousedown touchstart", function() {
				h = setTimeout(function() {
					f = true;
					e();
				}, 1000);
				g.on("mouseup touchend", function(j) {
					j.preventDefault();
					clearTimeout(h);
					if (!f) {
						g.trigger("shortpress", j);
					}
					f = false;
					g.off("mouseup touchend mouseout");
				});
				g.on("mouseout", function() {
					clearTimeout(h);
					f = false;
					g.off("mouseup touchend mouseout");
				});
			});

			function e() {
				g.trigger("longpress");
			}
		}
		d($("#btnBf"));
		d($("#btnFf"));
		$("#btnBf").on("shortpress", function(f, g) {
			console.log("event: shortpress BF1", f.type);
			console.log("event: shortpress BF2", g.type);
			Player.btnBf_click(g);
		});
		$("#btnBf").on("longpress", function() {
			Player.btnBf_longclick();
		});
		$("#btnFf").on("shortpress", function(f, g) {
			Player.btnFf_click(g);
		});
		$("#btnFf").on("longpress", function() {
			Player.btnFf_longclick();
		});
		$("#btnX").on("mousedown touchstart", function(g) {
			g.preventDefault();
			Player.is_X_moving = true;
			var f;
			if (g.type == "touchstart") {
				g = g.touches[0];
			}
			f = {
				x: g.pageX,
				y: g.pageY
			};
			$(document).on("mousemove touchmove", function(h) {
				h.preventDefault();
				if (Player.is_X_moving) {
					getX(h, f);
				}
			});
			$(document).on("mouseup touchend", function(h) {
				h.preventDefault();
				$(document).off("mousemove touchmove mouseup touchend");
				Player.is_X_moving = false;
				Player.rate = Player.rate0 = Player.obj.playbackRate;
			});
			this.blur();
		});
		$("#btnX").on("click touchend", function(f) {
			if (f.type == "click") {} else {
				if (f.type == "touchend") {
					f = f.changedTouches[0];
					var g = $(this).offset();
					if (!isInElem(this, {
							x: f.clientX,
							y: f.clientY
						})) {
						return;
					}
				}
			}
			$("#btnX").text("1.0");
			Player.rate = 1;
			Player.obj.playbackRate = 1;
			this.blur();
			$("#btns").focus();
		});
		$("#btnP").on("mousedown touchstart", function(g) {
			g.preventDefault();
			Player.is_btnP_down = true;
			var f;
			if (g.type == "touchstart") {
				g = g.touches[0];
			}
			f = {
				x: g.pageX,
				y: g.pageY
			};
			$(document).on("mousemove touchmove", function(h) {
				h.preventDefault();
				if (Player.is_btnP_down) {
					getP(h, f);
				}
			});
			$(document).on("mouseup touchend", function(h) {
				h.preventDefault();
				$(document).off("mousemove touchmove mouseup touchend");
				if (!Player.is_btnP_moving) {
					Player.btnP_click();
				} else {
					Player.R_time_wait = Player.R_time_wait_drag;
				}
				Player.is_btnP_down = false;
				Player.is_btnP_moving = false;
			});
			this.blur();
		});
		$("#btnR").on("mousedown touchstart", function(g) {
			g.preventDefault();
			Player.is_btnR_down = true;
			var f;
			if (g.type == "touchstart") {
				g = g.touches[0];
			}
			f = {
				x: g.pageX,
				y: g.pageY
			};
			$(document).on("mousemove touchmove", function(h) {
				h.preventDefault();
				if (Player.is_btnR_down) {
					getR(h, f);
				}
			});
			$(document).on("mouseup touchend", function(h) {
				h.preventDefault();
				$(document).off("mousemove touchmove mouseup touchend");
				if (!Player.is_btnR_moving) {
					Player.btnR_click();
				}
				Player.is_btnR_down = false;
				Player.is_btnR_moving = false;
				Player.r_cnt0 = Player.r_cnt;
			});
			this.blur();
		});

		function a(e, f) {
			e.on("mousedown touchstart", function(j) {
				j.preventDefault();
				var g = false;
				if (f == "A") {
					g = true;
				}
				if (g) {
					Player.is_btnA_down = true;
					Player.dotA_old = Player.dotA;
					Player.dotA_wy = 0;
				} else {
					Player.is_btnB_down = true;
					Player.dotB_old = Player.dotB;
					Player.dotB_wy = 0;
				}
				var h;
				if (j.type == "touchstart") {
					j = j.touches[0];
				}
				h = {
					x: j.pageX,
					y: j.pageY
				};
				$(document).on("mousemove touchmove", function(k) {
					k.preventDefault();
					if (g) {
						Player.is_btnA_moving = true;
						if (Player.is_btnA_down) {
							getAB(k, h, true);
						}
					} else {
						Player.is_btnB_moving = true;
						if (Player.is_btnB_down) {
							getAB(k, h, false);
						}
					}
				});
				$(document).on("mouseup touchend", function(k) {
					$(document).off("mousemove touchmove mouseup touchend");
					if (g) {
						if (Player.dotA_wy < 6) {
							Player.btnA_click(k);
						}
						Player.is_btnA_down = false;
						Player.is_btnA_moving = false;
						Player.dotA_old = Player.dotA;
						e.text("");
					} else {
						if (Player.dotB_wy < 6) {
							Player.btnB_click(k);
						}
						Player.is_btnB_down = false;
						Player.is_btnB_moving = false;
						Player.dotB_old = Player.dotB;
						e.text("");
					}
					checkAB();
				});
				this.blur();
			});
		}
		a($("#btnA"), "A");
		a($("#btnB"), "");
		$("#btnC").on("mousedown touchend", function(f) {
			Player.btnC_click();
		});
		$("#btn-audio").on("click touchend", function(f) {
			f.preventDefault();
			Player.stop();
			Player.obj = Player.obja;
			bindDisp();
			$("#vp").css("display", "none");
			Player.dispSrc(mp3filename + ".mp3");
			if (lrc) {
				$("#btnsTC").show();
				$("#txtWin").hide();
				$("#lrcWin").show();
				nowShow = "lrc";
			}
			this.blur();
		});
		$("#btn-video").on("click touchend", function(f) {
			f.preventDefault();
			Player.stop();
			Player.obj = Player.objv;
			bindDisp();
			$("#vp").css("display", "block");
			Player.dispSrc(progfilename + ".mp4");
			$("#uc2").hide();
			$("#txtWin").show();
			this.blur();
		});
	},
	bindEvents: function() {
		$("#ap, #vp").on("play", function() {});
		$("#ap, #vp").on("ended", function() {
			if (Player.state2 == 2 || Player.is_slider_dragging) {
				return;
			}
			Player.obj.currentTime = 0;
			Player.play();
		});
		$("#ap, #vp").on("play", function() {
			Player.play(0);
			Player.state2 = 1;
		});
		$("#ap, #vp").on("pause", function() {
			Player.pause(0);
		});
	},
	sliderWidth: function() {
		return $("#slider-frame").width();
	},
	dispMS: function() {
		$("#timebox").text(Player.currentMSstring());
	},
	dispSrc: function(a) {
		$("#srcname").html('<a href="' + a + '" title="鍙抽敭鍙﹀瓨涓嬭浇锛岀Щ鍔ㄨ澶囬暱鎸変笅杞�">' + a + "</a>");
	},
	NtoMSstring: function(c) {
		var a = parseInt(c / 60);
		var b = (c % 60).toFixed();
		a = (a < 10) ? "0" + a : a;
		b = (b < 10) ? "0" + b : b;
		return a + ":" + b;
	},
	currentMSstring: function() {
		return this.NtoMSstring(this.obj.currentTime) + " / " + this.NtoMSstring(this.obj.duration);
	},
	rgb2hex: function(a) {
		a = a.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

		function b(c) {
			return ("0" + parseInt(c).toString(16)).slice(-2);
		}
		return "#" + b(a[1]) + b(a[2]) + b(a[3]);
	},
	playersize: function() {
		if (Player.play_list[Player.current_index].substr(-3) == "mp4") {
			Player.videosize();
		} else {
			Player.audiosize();
		}
	},
	audiosize: function() {
		$("#vp").css("display", "none");
	},
	videosize: function() {
		$("#vp").css("display", "block");
	},
	init: function() {
		this.obja = document.getElementById("ap");
		this.objv = document.getElementById("vp");
		if (detectTouch()) {
			this.is_touch = true;
		}
		this.btnBorderColor = this.rgb2hex($("#btns button").css("borderTopColor"));
		this.ch();
	}
};

function getX(f, d) {
	if (f.type == "touchmove") {
		f = f.touches[0];
	}
	var a, c = f.pageX - d.x,
		b = d.y - f.pageY;
	a = (myabs(c) >= myabs(b)) ? c : b;
	a = parseInt(a / 25);
	a = Player.rate + a / 10;
	if (a > Player.ratemax) {
		a = Player.ratemax;
	} else {
		if (a < Player.ratemin) {
			a = Player.ratemin;
		}
	}
	a = a.toFixed(1);
	Player.obj.playbackRate = parseFloat(a);
	$("#btnX").text(a);
}

function myabs(a) {
	if (a > 0) {
		return a;
	} else {
		return -a;
	}
}

function getP(f, d) {
	if (f.type == "touchmove") {
		f = f.touches[0];
	}
	var a, c = f.pageX - d.x,
		b = d.y - f.pageY;
	a = (myabs(c) >= myabs(b)) ? c : b;
	Player.is_btnP_moving = (function() {
		var e = a > 0 ? a : -a;
		if (e > 10) {
			return true;
		} else {
			return false;
		}
	})();
	a = parseInt(a / 20);
	a = Player.R_time_wait / 1000 + a;
	if (a > 99) {
		a = 99;
	} else {
		if (a < 0) {
			a = 0;
		}
	}
	$("#btnP").text(a > 0 ? a : "");
	Player.R_time_wait_drag = a * 1000;
}

function getR(f, d) {
	if (f.type == "touchmove") {
		f = f.touches[0];
	}
	var a, c = f.pageX - d.x,
		b = d.y - f.pageY;
	a = (myabs(c) >= myabs(b)) ? c : b;
	Player.is_btnR_moving = (function() {
		var e = a > 0 ? a : -a;
		if (e > 10) {
			return true;
		} else {
			return false;
		}
	})();
	a = parseInt(a / 20);
	a = Player.r_cnt0 + a;
	if (a > 99) {
		a = 99;
	} else {
		if (a < 0) {
			a = 0;
		}
	}
	if (a) {
		if (Player.is_R || is_R_tc) {
			$("#btnR").text((Player.r_cnt_now + 1) + "/" + a);
		} else {
			$("#btnR").text(a);
		}
	} else {
		$("#btnR").text("");
	}
	Player.r_cnt = a;
}

function getAB(h, g, c) {
	if (h.type == "touchmove") {
		h = h.touches[0];
	}
	var b, f = h.pageX - g.x,
		d = g.y - h.pageY;
	b = (myabs(f) >= myabs(d)) ? f : d;
	c ? (Player.dotA_wy = ((b >= 0) ? b : -b)) : (Player.dotB_wy = ((b >= 0) ? b : -b));
	b = parseInt(b / 25);
	c ? (Player.dotA = Player.dotA_old + b) : (Player.dotB = Player.dotB_old + b);
	if (c) {
		if (Player.dotA < 0) {
			Player.dotA = 0;
		} else {
			if (Player.dotA > Player.obj.duration) {
				Player.dotA = Player.obj.duration;
			}
		}
		Player.labelA_x = Player.dotA / Player.obj.duration * Player.sliderWidth();
		if (!Player.is_labelA_show) {
			return;
		}
		$("#lblA").css({
			left: Player.labelA_x
		});
		$("#btnA").text(b);
	} else {
		if (Player.dotB < 0) {
			Player.dotB = 0;
		} else {
			if (Player.dotB > Player.obj.duration) {
				Player.dotB = Player.obj.duration;
			}
		}
		Player.labelB_x = Player.dotB / Player.obj.duration * Player.sliderWidth();
		if (!Player.is_labelB_show) {
			return;
		}
		$("#lblB").css({
			left: Player.labelB_x + 10
		});
		$("#btnB").text(b);
	}
}

function checkAB() {
	if (!Player.is_labelA_show || !Player.is_labelB_show) {
		return;
	}
	if (Player.labelA_x > Player.labelB_x) {
		var a = Player.labelA_x;
		Player.labelA_x = Player.labelB_x;
		Player.labelB_x = a;
		a = Player.dotA;
		Player.dotA = Player.dotB;
		Player.dotB = a;
		$("#lblA").css({
			left: Player.labelA_x,
			display: "block"
		});
		$("#lblB").css({
			left: Player.labelB_x + 10,
			display: "block"
		});
	}
}

function bindSlider() {
	var b = $(Player.obj),
		a = b[0];
	$("#slider").mousedown(function(c) {
		c.preventDefault();
		if (Player.is_touch) {
			return;
		}
		Player.is_slider_dragging = true;
		gotoE(c);
		$("#playerwrap").on("mousemove", function(d) {
			d.preventDefault();
			if (Player.is_touch) {
				return;
			}
			if (Player.is_slider_dragging) {
				gotoE(d);
			}
		});
	});
	$("#playerwrap").on("mouseup mouseleave", function(c) {
		if (Player.is_touch) {
			return;
		}
		$("#playerwrap").off("mousemove");
		Player.is_slider_dragging = false;
	});
	$("#slider").on("touchstart", function(c) {
		c.preventDefault();
		Player.is_slider_dragging = true;
		gotoETouch(c);
	});
	$("#slider").on("touchmove", function(c) {
		c.preventDefault();
		Player.is_slider_dragging = true;
		gotoETouch(c);
	});
	$("#slider").on("touchend", function(c) {
		c.preventDefault();
		Player.is_slider_dragging = false;
		gotoETouch(c);
	});
}

function gotoE(b) {
	var a = b.pageX - $("#slider-frame").offset().left;
	Player.obj.currentTime = Player.obj.duration * a / Player.sliderWidth();
}

function gotoETouch(b) {
	var c, a;
	if (b.type == "touchend") {
		c = b.changedTouches[0];
	} else {
		c = b.touches[0];
	}
	a = c.pageX - $("#slider-frame").offset().left;
	Player.obj.currentTime = Player.obj.duration * a / Player.sliderWidth();
}
$(function() {
	Player.init();
	var a = document.getElementById("slider-frame");
	bindSlider();
	Player.bindBtns();
	Player.bindEvents();
	InstallHtmlFuncKeys();
	bindothers();
});
$(window).scroll(function() {
	var d = $(window);
	var c = $("#playerblock");
	var e = $("#playerwrap");
	var j = d.scrollTop();
	var b = c.offset().top;
	if (j > b) {
		e.addClass("stick0");
	} else {
		e.removeClass("stick0");
	}
	var g = $("#srcWinBarBlock");
	var a = $("#srcWinBar");
	var f = g.offset().top;
	var h = $("#playerblock").outerHeight();
	if (j > f - h) {
		a.addClass("stick1");
		a.css("top", h);
	} else {
		a.removeClass("stick1");
	}
});
$(window).resize(function() {
	var a = $(window).width();
});

function InstallHtmlFuncKeys() {
	document.onkeydown = function(b) {
		var c = b || window.event,
			a = c.keyCode;
		if (a >= 112 && a <= 123) {
			_keycode = a;
			switch (a) {
				case keycode_F1:
					F1();
					break;
				case keycode_F2:
					F2();
					break;
				case keycode_F3:
					F3();
					break;
				case keycode_F4:
					F4();
					break;
				case keycode_F5:
					return;
				case keycode_F6:
					F6();
					break;
				case keycode_F7:
					F7();
					break;
				case keycode_F8:
					F8();
					break;
				case keycode_F9:
					F9();
					break;
				case keycode_F10:
					F10();
					break;
				case keycode_F11:
					F11();
					break;
				case keycode_F12:
					F12();
					break;
				default:
					break;
			}
			c.returnValue = false;
			c.preventDefault();
			c.stopPropagation();
			return false;
		}
	};
}

function F5() {}

function F7() {
	Player.btnStop_click();
}

function F8() {
	Player.btnPlay_click();
}

function F9() {
	Player.btnR_click();
}

function F10() {}

function F11() {}

function F12() {}

function disp(b) {
	var a = document.getElementById("disp").innerText;
	a = a + " | " + b;
	document.getElementById("disp").innerText = a;
}

function displist() {
	var a = Player.play_list.join("|");
	a = a + "||" + Player.obj.src;
	$("#disp-list").html(a);
}

function dispState() {
	$("#readystate").text("鐘舵€�:" + Player.obj.readyState + ", 闀垮害:" + Player.obj.duration + ", 鏆傚仠鍚�:" + Player.obj.paused + ", state=" + Player.state + ", ended=" + Player.obj.ended + ", Player.rate=" + Player.rate + ", obj.rate=" + Player.obj.playbackRate);
}

function isInElem(e, d) {
	$o = $(e);
	var a = $o.offset().left,
		f = $o.offset().top,
		b = $o.outerWidth(),
		c = $o.outerHeight();
	a = a - $(document).scrollLeft();
	f = f - $(document).scrollTop();
	if ((d.x >= a) && (d.x <= a + b) && (d.y >= f) && (d.y <= f + c)) {
		return true;
	} else {
		return false;
	}
}

function touch(a) {
	var b = a || window.event,
		c = b.touches[0];
}

function getxy(b) {
	var a = "clientXY: " + b.clientX.toFixed() + ", " + b.clientY.toFixed() + "\npageXY: " + b.pageX.toFixed() + ", " + b.pageY.toFixed() + "\nscreenXY:" + b.screenX.toFixed() + ", " + b.screenY.toFixed();
	return a;
}

function detectTouch() {
	if ((navigator.userAgent.match(/(iPhone|iPad|iPod|Android|ios|Symbian|mobile|ubweb|windows ce)/i))) {
		return true;
	} else {
		return false;
	}
}

function bindothers() {
	(function() {
		document.getElementById("btn-usage").onclick = function(c) {
			if ($("#btnsTC").is(":visible")) {
				$("#uc2").show();
			} else {
				$("#uc2").hide();
			}
			$("#usagecontent").slideToggle();
		};
	})();
	(function() {
		document.getElementById("btn-edit").onclick = function(c) {
			if ($("#editWin").is(":hidden")) {
				$("#editWin").show();
				is_editWin_show = true;
			} else {
				$("#editWin").hide();
				is_editWin_show = false;
			}
		};
	})();
	(function() {
		document.getElementById("btn-src").onclick = function(c) {
			if ($("#srcWin").is(":hidden")) {
				$("#srcWin").show();
				$("#btn-src").css("background-image", "url(/public/webr8/img/srcshow.png)");
				is_editSrc_show = true;
			} else {
				$("#srcWin").hide();
				$("#btn-src").css("background-image", "url(/public/webr8/img/srchide.png)");
				is_editSrc_show = false;
			}
		};
	})();
	(function() {
		$("#tablrc").click(function() {
			if ($("#tablrc").is(".tabshow")) {
				return;
			}
			$("#tablrc").addClass("tabshow");
			$("#tabtxt").removeClass("tabshow");
			$("#lrc").show();
			$("#txt").hide();
		});
	})();
	(function() {
		$("#tabtxt").click(function() {
			if ($("#tabtxt").is(".tabshow")) {
				return;
			}
			$("#tabtxt").addClass("tabshow");
			$("#tablrc").removeClass("tabshow");
			$("#txt").show();
			$("#lrc").hide();
		});
	})();

	function a(c) {
		if (c) {
			$("#txt").show();
			$("#btn-txt").css("background-image", "url(/public/webr8/img/txt.png)");
			is_txt_show = true;
		} else {
			$("#txt").hide();
			$("#btn-txt").css("background-image", "url(/public/webr8/img/txtno.png)");
			is_txt_show = false;
		}
	}

	function b(c) {
		if (c) {
			$("#lrc").show();
			$("#btn-lrc").css("background-image", "url(/public/webr8/img/lrc.png)");
			is_lrc_show = true;
		} else {
			$("#lrc").hide();
			$("#btn-lrc").css("background-image", "url(/public/webr8/img/lrcno.png)");
			is_lrc_show = false;
		}
	}(function() {
		if ($("#btn-txt").length == 0) {
			return;
		}
		document.getElementById("btn-txt").onclick = function(c) {
			if ($("#txt").is(":visible")) {
				a(false);
				b(true);
			} else {
				a(true);
				b(false);
			}
		};
	})();
	(function() {
		if ($("#btn-lrc").length == 0) {
			return;
		}
		document.getElementById("btn-lrc").onclick = function(c) {
			if ($("#lrc").is(":visible")) {} else {}
			$("#btn-txt").click();
		};
	})();
	(function() {
		$("#srcWinBarFull").click(function() {
			if ($("#tablrc").is(".tabshow")) {
				$("#lrc").css({
					height: "auto",
					overflowY: "visible"
				});
			} else {
				$("#txt").css({
					height: "auto",
					overflowY: "visible"
				});
			}
		});
	})();
	(function() {
		$("#srcWinBarPart").click(function() {
			if ($("#tablrc").is(".tabshow")) {
				$("#lrc").css({
					height: "300px",
					overflowY: "scroll"
				});
			} else {
				$("#txt").css({
					height: "300px",
					overflowY: "scroll"
				});
			}
		});
	})();
	! function() {
		var d;
		var f = false;
		var g = document.getElementById("vp");
		g.onclick = function(h) {
			h.preventDefault();
			clearTimeout(d);
			d = setTimeout(function() {
				Player.btnPlay_click();
			}, 300);
		};
		g.ondblclick = function(h) {
			var h = h || window.event;
			if (window.event) {
				h.cancelBubble = true;
			} else {
				h.stopPropagation();
			}
			h.preventDefault();
			clearTimeout(d);
			if (f) {
				c(g);
				f = false;
			} else {
				e(g);
				f = true;
			}
			console.log("dbl click");
		};

		function e(h) {
			if (h.requestFullscreen) {
				h.requestFullscreen();
			} else {
				if (h.webkitRequestFullScreen) {
					h.webkitRequestFullScreen();
				} else {
					if (h.mozRequestFullScreen) {
						h.mozRequestFullScreen();
					} else {
						if (h.msRequestFullscreen) {
							h.msRequestFullscreen();
						}
					}
				}
			}
		}

		function c(h) {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else {
				if (document.webkitCancelFullScreen) {
					document.webkitCancelFullScreen();
				} else {
					if (document.mozCancelFullScreen) {
						document.mozCancelFullScreen();
					} else {
						if (document.msExitFullscreen) {
							document.msExitFullscreen();
						}
					}
				}
			}
		}
	}();
}

function fontSize(c, a, b) {
	var c = c || window.event;
	var g;
	if (a == 0) {
		g = $("#editWinText");
	} else {
		if ($("#tablrc").is(".tabshow")) {
			g = $("#lrc li");
		} else {
			g = $("#txt li");
		}
	}
	if (c.ctrlKey) {
		g.css("font-size", "16px");
		return;
	}
	var d;
	d = parseInt(g.css("font-size"));
	if (b == -1) {
		if (d != 12) {
			g.css("font-size", (d - 2) + "px");
		}
	} else {
		if (b == 1) {
			if (d != 24) {
				g.css("font-size", (d + 2) + "px");
			}
		}
	}
}

function send() {
	var a = document.getElementById("editWinForm").editWinText.value.trim();
	if (a == "") {
		alert("娌℃湁鍐呭锛屾棤娉曚繚瀛橈紒\n\nNothing to Save!");
		return;
	}
	if (a.length > 100000) {
		alert("浜诧細鎮ㄥ啓寰楀お澶氫簡锛屾垜淇濆瓨涓嶄笅锛乗n\nText Length Cannot Access 100K !");
		return;
	}
	document.getElementById("editWinForm").submit();
}

function basename(b) {
	var a = b.lastIndexOf("/");
	if (a == -1) {
		return b;
	} else {
		return b.substr(a + 1);
	}
}

function filefirstname(a) {
	var b = a.lastIndexOf(".");
	if (b == -1) {
		return a;
	}
	return a.substr(0, b);
}

function filelastname(a) {
	var b = a.lastIndexOf(".");
	if (b == -1) {
		return a;
	}
	return a.substr(b + 1);
}
String.prototype.trim = function() {
	return this.replace(/(^\s*)|(\s*$)/g, "");
};
String.prototype.ltrim = function() {
	return this.replace(/(^\s*)/g, "");
};
String.prototype.rtrim = function() {
	return this.replace(/(\s*$)/g, "");
};

function yellowline(a) {
	$("#lrc li").css("background-color", "");
	$("#lrc div").eq(a).children("li").css("background-color", "#ffee44");
}

function btnTC_on(a, b) {
	a.css("background-color", b ? "#ffee00" : "");
}

function btnTC_off() {
	btnTC_on($("#btnTCRline"), false);
	btnTC_on($("#btnTCRlines"), false);
	btnTC_on($("#btnTCXRline"), false);
	btnTC_on($("#btnTCXRlines"), false);
}

function clearTCTimer(a) {
	clearInterval(playtcTimer);
	is_R_tc = false;
	Player.r_cnt_now = 0;
	btnTC_off();
	if (a) {
		Player.rate = Player.rate0;
		Player.setPlayerRate(Player.rate);
		$("#btnR").text(Player.r_cnt0 ? Player.r_cnt0 : "");
	}
}

function playTCline(a) {
	is_R_tc = true;
	tcMode = 0;
	tcIndex = a;
	tcFrom = tc[a];
	if (a < tcLength - 1) {
		tcTo = tc[a + 1];
	} else {
		tcTo = Player.obj.duration;
	}
	Player.obj.currentTime = tcFrom;
	Player.play();
	Player.obj.playbackRate = Player.rate;
	clearTCTimer();
	playtcTimer = setInterval(function() {
		if (Player.obj.currentTime > tcTo - 0.1) {
			Player.pause();
			clearTCTimer();
			Player.obj.currentTime = tcFrom;
			is_R_tc = false;
		}
	}, 20);
}

function playTCRline(a) {
	tcMode = 1;
	tcIndex = a;
	tcFrom = tc[a];
	if (a < tcLength - 1) {
		tcTo = tc[a + 1];
	} else {
		tcTo = Player.obj.duration;
	}
	Player.obj.currentTime = tcFrom;
	Player.play();
	Player.obj.playbackRate = Player.rate;
	clearTCTimer();
	btnTC_on($("#btnTCRline"), true);
	is_R_tc = true;
	Player.r_cnt_now = 0;
	disped = false;
	playtcTimer = setInterval(function() {
		if (Player.r_cnt0 && !disped) {
			$("#btnR").text((Player.r_cnt_now + 1) + "/" + Player.r_cnt0);
			disped = true;
		}
		if (Player.obj.currentTime > tcTo - 0.1) {
			Player.pause();
			Player.obj.currentTime = tcFrom;
			if (Player.r_cnt0 && ++Player.r_cnt_now >= Player.r_cnt0) {
				clearTCTimer(true);
				is_R_tc = false;
			} else {
				disped = false;
				timer_R_tc = setTimeout(function() {
					Player.play();
				}, Player.R_time_wait);
			}
		}
	}, 20);
}

function playTCRlines() {
	tcMode = 2;
	i = tcIndex;
	tcFrom = tc[tcIndex];
	if (i < tcLength - 1) {
		tcTo = tc[i + 1];
	} else {
		tcTo = Player.obj.duration;
	}
	Player.obj.currentTime = tcFrom;
	Player.play();
	Player.obj.playbackRate = Player.rate;
	clearTCTimer(false);
	btnTC_on($("#btnTCRlines"), true);
	is_R_tc = true;
	Player.r_cnt_now = 0;
	disped = false;
	playtcTimer = setInterval(function() {
		if (Player.r_cnt0 == 0) {
			cntR_tc = 3;
		} else {
			cntR_tc = Player.r_cnt0;
		}
		if (!disped) {
			$("#btnR").text((Player.r_cnt_now + 1) + "/" + cntR_tc);
			disped = true;
		}
		if (Player.obj.currentTime > tcTo - 0.1) {
			Player.pause();
			Player.obj.currentTime = tcFrom;
			if (++Player.r_cnt_now >= cntR_tc) {
				clearTCTimer(false);
				if (tcIndex == tcLength - 1) {
					tcIndex = 0;
				} else {
					tcIndex++;
				}
				$("#btnR").text(cntR_tc);
				playTCRlines(tcIndex);
			} else {
				disped = false;
			}
			timer_R_tc = setTimeout(function() {
				Player.play();
			}, Player.R_time_wait);
		}
	}, 20);
}

function playTCXRline(a) {
	tcMode = 3;
	tcIndex = a;
	tcFrom = tc[a];
	if (a < tcLength - 1) {
		tcTo = tc[a + 1];
	} else {
		tcTo = Player.obj.duration;
	}
	Player.obj.currentTime = tcFrom;
	Player.play();
	Player.obj.playbackRate = 1;
	Player.setPlayerRate(1);
	clearTCTimer(false);
	btnTC_on($("#btnTCXRline"), true);
	is_R_tc = true;
	Player.r_cnt_now = 1;
	disped = false;
	playtcTimer = setInterval(function() {
		if (Player.r_cnt0 && !disped) {
			$("#btnR").text(Player.r_cnt_now + "/" + Player.r_cnt0);
			disped = true;
		}
		if (Player.obj.currentTime > tcTo - 0.1) {
			Player.pause();
			Player.obj.currentTime = tcFrom;
			if (Player.r_cnt0 && Player.r_cnt_now >= Player.r_cnt0) {
				clearTCTimer(true);
			} else {
				if ((Player.r_cnt_now) % 3 == 1) {
					Player.setPlayerRate(0.7);
				} else {
					if ((Player.r_cnt_now) % 3 == 2) {
						Player.setPlayerRate(1.5);
					} else {
						if ((Player.r_cnt_now) % 3 == 0) {
							Player.setPlayerRate(1);
						}
					}
				}
				disped = false;
				timer_R_tc = setTimeout(function() {
					Player.play();
				}, Player.R_time_wait);
			}
			Player.r_cnt_now++;
		}
	}, 20);
}

function playTCXRlines() {
	tcMode = 4;
	i = tcIndex;
	tcFrom = tc[tcIndex];
	if (i < tcLength - 1) {
		tcTo = tc[i + 1];
	} else {
		tcTo = Player.obj.duration;
	}
	Player.obj.currentTime = tcFrom;
	Player.play();
	Player.obj.playbackRate = 1;
	Player.setPlayerRate(1);
	clearTCTimer(false);
	btnTC_on($("#btnTCXRlines"), true);
	is_R_tc = true;
	Player.r_cnt_now = 0;
	disped = false;
	playtcTimer = setInterval(function() {
		if (Player.r_cnt0 == 0) {
			cntR_tc = 3;
		} else {
			cntR_tc = Player.r_cnt0;
		}
		if (!disped) {
			$("#btnR").text((Player.r_cnt_now + 1) + "/" + cntR_tc);
			disped = true;
		}
		if (Player.obj.currentTime > tcTo - 0.1) {
			Player.pause();
			Player.obj.currentTime = tcFrom;
			if (++Player.r_cnt_now >= cntR_tc) {
				clearTCTimer(false);
				$("#btnR").text("");
				if (tcIndex == tcLength - 1) {
					tcIndex = 0;
				} else {
					tcIndex++;
				}
				playTCXRlines(tcIndex);
			} else {
				if ((Player.r_cnt_now) % 3 == 1) {
					Player.setPlayerRate(0.7);
				} else {
					if ((Player.r_cnt_now) % 3 == 2) {
						Player.setPlayerRate(1.5);
					} else {
						if ((Player.r_cnt_now) % 3 == 0) {
							Player.setPlayerRate(1);
						}
					}
				}
				disped = false;
				timer_R_tc = setTimeout(function() {
					Player.play();
				}, Player.R_time_wait);
			}
		}
	}, 20);
}
$(function() {
	tcLength = tc.length;
	if (mp3) {
		Player.obja.src = mp3filename + ".mp3";
	}
	if (mp4) {
		Player.objv.src = progfilename + ".mp4";
	}
	if ((vf && mp4) || (!mp3 && mp4)) {
		Player.obj = Player.objv;
		srcNow = progfilename + ".mp4";
		$("#ap").hide();
		$("#vp").show();
		if ("lrc") {
			nowShow = "lrc";
		} else {
			nowShow = "txt";
			$("#btnsTC").hide();
			$("#lrc").hide();
			$("#txt").show();
		}
	} else {
		Player.obj = Player.obja;
		srcNow = mp3filename + ".mp3";
	}
	if (!lrc) {
		$("#txt").show();
	} else {
		$("#txt").hide();
	}
	bindDisp();
	if (Player.is_touch) {
		$("#txt, #lrc").css({
			"padding-left": "8px",
			"padding-right": "8px"
		});
		$("#txt span, #lrc span").css({
			"padding-top": "5px"
		});
		$("#txt li, #lrc li").css({
			"font-size": "18px"
		});
	}
	$("#lrc li").click(function() {
		var a = $(this).parent().index();
		playTCline(a);
	});
	$("#lrc li").dblclick(function() {});
	$("#btnTCPlay").click(function() {
		playTCline(tcIndex);
	});
	$("#btnTCStop").click(function() {
		$("#btnStop").click();
		Player.obj.currentTime = tc[tcIndex];
		Player.pause();
		$("#btnR").text(Player.r_cnt0 ? Player.r_cnt0 : "");
	});
	$("#btnTCBf").click(function() {
		if (tcIndex > 0) {
			tcIndex--;
		}
		tcFrom = tc[tcIndex];
		tcTo = tc[tcIndex + 1];
		Player.r_cnt_now = 0;
		Player.obj.currentTime = tcFrom;
		Player.obj.playbackRate = Player.rate;
	});
	$("#btnTCFf").click(function() {
		if (tcIndex < tcLength - 1) {
			tcIndex++;
		}
		tcFrom = tc[tcIndex];
		tcTo = (tcIndex < (tcLength - 1) ? tc[tcIndex + 1] : Player.obj.duration);
		Player.r_cnt_now = 0;
		Player.obj.currentTime = tcFrom;
		Player.obj.playbackRate = Player.rate;
	});
	$("#btnTCRline").click(function() {
		playTCRline(tcIndex);
	});
	$("#btnTCRlines").click(function() {
		playTCRlines();
	});
	$("#btnTCXRline").click(function() {
		playTCXRline(tcIndex);
	});
	$("#btnTCXRlines").click(function() {
		playTCXRlines();
	});
});

function bindDisp() {
	$(Player.obj).on("timeupdate", function(h) {
		var a = this.currentTime / this.duration * Player.sliderWidth();
		$("#slider-play").width(a);
		Player.dispMS();
		if (!lrc || nowShow == "txt") {
			return;
		}
		var c = this.currentTime.toFixed(2);
		for (var f = 0; f < tcLength; f++) {
			if (tc[f] > c) {
				break;
			}
		}
		tcIndex = f - 1;
		if (tcIndex < 0) {
			tcIndex = 0;
		}
		yellowline(tcIndex);
		var d = $("#lrc div:eq(" + tcIndex + ")");
		var g = d.position().top;
		var b = $("#lrc").scrollTop();
		if (g > 250 || g < 10) {
			$("#lrc").scrollTop(b + g - 40);
		}
	});
	$(Player.obj).on("loadeddata", function(a) {
		Player.dispMS();
		Player.dispSrc(srcNow);
	});
}
$("#disp1").click(function() {
	$(this).text(playtcTimer);
});