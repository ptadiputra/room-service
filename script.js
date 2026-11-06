(function () {
  'use strict';

  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
  var sceneNum = document.getElementById('sceneNum');
  var progressBar = document.getElementById('progressBar');
  var prevBtn = document.getElementById('prevBtn');
  var soundToggle = document.getElementById('soundToggle');
  var s12 = document.getElementById('s12');
  var finalBadge = document.getElementById('finalBadge');
  var evalStatus = document.getElementById('evalStatus');
  var evalResult = document.getElementById('evalResult');
  var evalScoreEl = document.getElementById('evalScore');
  var evalComment = document.getElementById('evalComment');
  var evalQuizzes = Array.prototype.slice.call(document.querySelectorAll('#s11 .quiz'));

  var current = 1;
  var soundOn = true;
  var voice = null;
  var evalScore = 0;
  var lastScore = null;
  var TOTAL = scenes.length;

  /* ---------- TTS ---------- */
  function findVoice() {
    try {
      var vs = speechSynthesis.getVoices();
      voice = vs.filter(function (v) {
        return (v.lang || '').toLowerCase().indexOf('id') === 0;
      })[0] || null;
    } catch (e) { /* tanpa TTS: materi tetap terbaca */ }
  }

  try {
    findVoice();
    speechSynthesis.addEventListener('voiceschanged', findVoice);
  } catch (e) { /* browser tanpa speechSynthesis */ }

  function cancelSpeech() {
    try { speechSynthesis.cancel(); } catch (e) {}
  }

  function speak(text) {
    if (!soundOn || !text) return;
    try {
      cancelSpeech();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'id-ID';
      u.rate = 0.95;
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  soundToggle.addEventListener('click', function () {
    soundOn = !soundOn;
    soundToggle.textContent = soundOn ? '🔊' : '🔇';
    soundToggle.setAttribute('aria-pressed', String(soundOn));
    introVideo.muted = !soundOn;
    if (soundOn) speak(scenes[current - 1].dataset.narasi);
    else cancelSpeech();
  });

  /* ---------- Pembukaan: video intro + kartu nama ---------- */
  var intro = document.getElementById('intro');
  var introVideo = document.getElementById('introVideo');
  var heroCard = document.getElementById('heroCard');
  var nameInput = document.getElementById('nameInput');
  var nameError = document.getElementById('nameError');

  function endIntro() {
    introVideo.pause();
    intro.hidden = true;
    heroCard.hidden = false;
  }

  introVideo.addEventListener('ended', endIntro);
  introVideo.addEventListener('error', endIntro);
  document.getElementById('skipIntro').addEventListener('click', endIntro);

  // autoplay bersuara; jika diblokir browser, ulangi tanpa suara
  introVideo.play().catch(function () {
    introVideo.muted = true;
    introVideo.play().catch(function () {});
  });

  document.getElementById('startForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!nameInput.value.trim()) {
      nameError.hidden = false;
      nameInput.focus();
      return;
    }
    nameError.hidden = true;
    goTo(2);
  });

  nameInput.addEventListener('input', function () { nameError.hidden = true; });

  /* ---------- Navigasi adegan ---------- */
  function goTo(num) {
    cancelSpeech();
    scenes.forEach(function (s) { s.classList.remove('is-active'); });
    var el = document.getElementById('s' + num);
    el.classList.add('is-active');
    current = num;
    sceneNum.textContent = String(num);
    progressBar.style.width = (num / TOTAL) * 100 + '%';
    prevBtn.hidden = (num === 1 || num === 11);
    window.scrollTo(0, 0);
    speak(el.dataset.narasi);
  }

  prevBtn.addEventListener('click', function () {
    if (current > 1 && current !== 11) goTo(current - 1);
  });

  /* ---------- Tahapan materi (klik per langkah) ---------- */
  function sceneSteps(scene) {
    return Array.prototype.slice.call(scene.querySelectorAll('.step'));
  }

  function initSteps() {
    scenes.forEach(function (scene) {
      var steps = sceneSteps(scene);
      if (!steps.length) return;
      var groups = [];
      steps.forEach(function (s) {
        var k = parseInt(s.dataset.step, 10);
        if (groups.indexOf(k) < 0) groups.push(k);
      });
      groups.sort(function (a, b) { return a - b; });
      scene.__stepGroups = groups;
      scene.__revealed = 0;
      steps.forEach(function (s) { s.hidden = true; });
      var nav = scene.querySelector('.scene__nav');
      if (nav) nav.hidden = true;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--secondary step-btn';
      btn.textContent = 'Tampilkan berikutnya ▸';
      btn.addEventListener('click', function () { revealStep(scene); });
      scene.querySelector('.scene__body').appendChild(btn);
    });
  }

  function revealStep(scene) {
    var k = scene.__stepGroups[scene.__revealed];
    scene.querySelectorAll('.step[data-step="' + k + '"]').forEach(function (el) {
      el.hidden = false;
    });
    scene.__revealed++;
    if (scene.__revealed >= scene.__stepGroups.length) {
      scene.querySelector('.step-btn').hidden = true;
      var nav = scene.querySelector('.scene__nav');
      if (nav) nav.hidden = false;
    }
  }

  function resetSteps() {
    scenes.forEach(function (scene) {
      var steps = sceneSteps(scene);
      if (!steps.length) return;
      steps.forEach(function (s) { s.hidden = true; });
      scene.__revealed = 0;
      scene.querySelector('.step-btn').hidden = false;
      var nav = scene.querySelector('.scene__nav');
      if (nav) nav.hidden = true;
    });
  }

  /* ---------- Quiz generik ---------- */
  function resetQuiz(quiz) {
    delete quiz.dataset.done;
    delete quiz.dataset.scored;
    Array.prototype.forEach.call(quiz.querySelectorAll('.opt'), function (o) {
      o.classList.remove('correct', 'wrong', 'selected');
    });
    var fb = quiz.querySelector('.feedback');
    fb.hidden = true;
    fb.className = 'feedback';
    fb.textContent = '';
    quiz.querySelector('.after').hidden = true;
  }

  function showOk(quiz, text) {
    var fb = quiz.querySelector('.feedback');
    fb.hidden = false;
    fb.className = 'feedback is-ok';
    fb.textContent = '✓ ' + text;
  }

  function showErr(quiz) {
    quiz.dataset.missed = '1';
    var fb = quiz.querySelector('.feedback');
    fb.hidden = false;
    fb.className = 'feedback is-err';
    fb.innerHTML = '<p>✕ Belum tepat. Perhatikan kembali materi di atas.</p>' +
      '<button class="btn btn--retry" type="button">↻ Coba Lagi</button>';
  }

  function onCorrect(quiz) {
    quiz.dataset.done = '1';
    quiz.querySelector('.after').hidden = false;
    showOk(quiz, quiz.dataset.pembahasan || 'Jawaban benar.');
    if (quiz.closest('#s11')) evalCorrect(quiz);
  }

  function judgeSingle(quiz, btn) {
    var opts = Array.prototype.slice.call(quiz.querySelectorAll('.opt'));
    var idx = opts.indexOf(btn);
    if (idx === parseInt(quiz.dataset.jawaban, 10)) {
      btn.classList.add('correct');
      onCorrect(quiz);
    } else {
      btn.classList.add('wrong');
      opts[parseInt(quiz.dataset.jawaban, 10)].classList.add('correct');
      showErr(quiz);
    }
  }

  function judgeMulti(quiz) {
    var want = quiz.dataset.multi.split(',').map(function (s) { return parseInt(s, 10); });
    var opts = Array.prototype.slice.call(quiz.querySelectorAll('.opt'));
    var got = [];
    opts.forEach(function (o, i) { if (o.classList.contains('selected')) got.push(i); });
    var ok = got.length === want.length && want.every(function (i) { return got.indexOf(i) >= 0; });
    if (ok) {
      opts.forEach(function (o, i) {
        o.classList.remove('selected');
        if (want.indexOf(i) >= 0) o.classList.add('correct');
      });
      onCorrect(quiz);
    } else {
      showErr(quiz);
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;

    var retry = t.closest('.btn--retry');
    if (retry) { resetQuiz(retry.closest('.quiz')); return; }

    var gotoBtn = t.closest('[data-goto]');
    if (gotoBtn) {
      var v = gotoBtn.dataset.goto;
      if (v === 'restart') restartAll();
      else goTo(parseInt(v.substring(1), 10));
      return;
    }

    var check = t.closest('.btn-check');
    if (check) { judgeMulti(check.closest('.quiz')); return; }

    var opt = t.closest('.opt');
    if (opt && !opt.closest('.quiz').dataset.done) {
      var quiz = opt.closest('.quiz');
      if (quiz.dataset.multi) {
        opt.classList.toggle('selected');
      } else {
        judgeSingle(quiz, opt);
      }
      return;
    }
  });

  /* ---------- Evaluasi ---------- */
  function updateEvalStatus() {
    var done = evalQuizzes.filter(function (q) { return q.dataset.done; }).length;
    evalStatus.textContent = 'Soal ' + Math.min(done + 1, evalQuizzes.length) +
      '/' + evalQuizzes.length + ' · Skor ' + evalScore;
  }

  function evalCorrect(quiz) {
    if (!quiz.dataset.scored) {
      quiz.dataset.scored = '1';
      if (!quiz.dataset.missed) evalScore++;
    }
    var i = evalQuizzes.indexOf(quiz);
    if (i < evalQuizzes.length - 1) {
      evalQuizzes[i + 1].hidden = false;
      updateEvalStatus();
    } else {
      lastScore = evalScore;
      evalScoreEl.textContent = evalScore + '/' + evalQuizzes.length;
      evalComment.textContent = evalScore === 5 ? 'Sangat baik!'
        : evalScore >= 3 ? 'Bagus, tinjau lagi materi.'
        : 'Pelajari kembali materi.';
      evalResult.hidden = false;
      evalStatus.textContent = 'Selesai · Skor ' + evalScore;
      finalBadge.textContent = 'Skor evaluasi terakhir: ' + evalScore + '/' + evalQuizzes.length;
      finalBadge.hidden = false;
    }
  }

  function resetEval() {
    evalScore = 0;
    evalQuizzes.forEach(function (q, i) {
      resetQuiz(q);
      delete q.dataset.missed;
      q.hidden = i > 0;
    });
    evalResult.hidden = true;
    updateEvalStatus();
  }

  document.getElementById('evalReset').addEventListener('click', resetEval);

  /* ---------- Restart & selesai ---------- */
  function restartAll() {
    document.querySelectorAll('.quiz').forEach(resetQuiz);
    resetEval();
    lastScore = null;
    finalBadge.hidden = true;
    s12.classList.remove('is-finished');
    s12.querySelector('.done-card').hidden = true;
    resetSteps();
    goTo(1);
  }

  document.getElementById('doneBtn').addEventListener('click', function () {
    cancelSpeech();
    s12.classList.add('is-finished');
    s12.querySelector('.done-card').hidden = false;
  });

  /* ---------- Init ---------- */
  initSteps();
  goTo(1);
})();
