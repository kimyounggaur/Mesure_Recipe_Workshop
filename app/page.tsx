"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioClock, ScheduledNote } from "../src/game/audio/AudioClock";
import { getMeterLabel, LEVELS, Meter, NOTE_META, NoteValue, UNITS } from "../src/game/config";
import { drawStaff } from "../src/game/render/StaffRenderer";
import { calculateBar, getNextTargetIndex, judgeTiming, scoreTiming, TimingGrade } from "../src/game/systems/JudgementSystem";

type Screen = "build" | "practice" | "result";
type StoredProgress = { bestScore: number; stars: number; wrongTypes: Record<string, number> };

const DEFAULT_PROGRESS: StoredProgress = { bestScore: 0, stars: 0, wrongTypes: {} };

function formatUnits(units: number) {
  const beats = Math.abs(units) / 4;
  return Number.isInteger(beats) ? `${beats}` : beats.toFixed(1);
}

function createScheduledNotes(notes: NoteValue[]): ScheduledNote[] {
  let cursor = 0;
  return notes.map((note) => {
    const scheduled = { startUnit: cursor, durationUnits: UNITS[note], isRest: NOTE_META[note].isRest };
    cursor += UNITS[note];
    return scheduled;
  });
}

function StaffCanvas({ notes, meter, compact = false }: { notes: NoteValue[]; meter: Meter; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const render = () => {
      if (canvasRef.current) drawStaff(canvasRef.current, notes, getMeterLabel(meter), compact);
    };
    render();
    window.addEventListener("resize", render);
    return () => window.removeEventListener("resize", render);
  }, [compact, meter, notes]);

  return <canvas ref={canvasRef} className={`staff-canvas ${compact ? "staff-canvas--compact" : ""}`} aria-label="완성된 리듬 오선보" />;
}

export default function Home() {
  const [levelIndex, setLevelIndex] = useState(1);
  const [meter, setMeter] = useState<Meter>(LEVELS[1].meter);
  const [placedNotes, setPlacedNotes] = useState<NoteValue[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<NoteValue | null>(null);
  const [screen, setScreen] = useState<Screen>("build");
  const [feedback, setFeedback] = useState("재료 카드를 골라 조리대의 빈 박에 놓아 보세요.");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [haptic, setHaptic] = useState(true);
  const [lowSensory, setLowSensory] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceProgress, setPracticeProgress] = useState(0);
  const [lastJudgement, setLastJudgement] = useState<TimingGrade | null>(null);
  const [grades, setGrades] = useState<TimingGrade[]>([]);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [resultTotal, setResultTotal] = useState<number | null>(null);
  const [resultSaved, setResultSaved] = useState(false);
  const [progress, setProgress] = useState<StoredProgress>(() => {
    if (typeof window === "undefined") return DEFAULT_PROGRESS;
    const saved = window.localStorage.getItem("measure-recipe-progress");
    if (!saved) return DEFAULT_PROGRESS;
    try {
      return { ...DEFAULT_PROGRESS, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_PROGRESS;
    }
  });

  const audioRef = useRef<AudioClock | null>(null);
  const practiceStartRef = useRef(0);
  const expectedTimesRef = useRef<number[]>([]);
  const usedTargetsRef = useRef<Set<number>>(new Set());
  const gradesRef = useRef<TimingGrade[]>([]);
  const finishTimeoutRef = useRef<number | null>(null);

  const level = LEVELS[levelIndex];
  const targetUnits = meter.beatsPerBar * 4;
  const check = useMemo(() => calculateBar(placedNotes, targetUnits), [placedNotes, targetUnits]);
  const segments = useMemo(() => placedNotes.map((note, index) => ({
    note,
    index,
    startUnit: placedNotes.slice(0, index).reduce((sum, previous) => sum + UNITS[previous], 0),
    durationUnits: UNITS[note],
  })), [placedNotes]);
  const activeBeatCount = meter.beatsPerBar;
  const timingScore = scoreTiming(grades);
  const theoryScore = quizAnswer === "4" ? 100 : quizAnswer ? 0 : 0;
  const calculatedTotal = resultTotal ?? Math.round(50 + timingScore * 0.3 + theoryScore * 0.2);

  useEffect(() => {
    audioRef.current ??= new AudioClock();
    audioRef.current.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    return () => {
      if (finishTimeoutRef.current) window.clearTimeout(finishTimeoutRef.current);
    };
  }, []);

  function getAudio() {
    audioRef.current ??= new AudioClock();
    audioRef.current.setMuted(muted);
    return audioRef.current;
  }

  function vibrate(pattern: number | number[] = 18) {
    if (haptic && !lowSensory && "vibrate" in navigator) navigator.vibrate(pattern);
  }

  function selectLevel(index: number) {
    const next = LEVELS[index];
    setLevelIndex(index);
    setMeter(next.meter);
    setPlacedNotes([]);
    setSelectedMaterial(null);
    setScreen("build");
    setGrades([]);
    setQuizAnswer(null);
    setResultTotal(null);
    setResultSaved(false);
    setFeedback(next.prompt);
  }

  function selectMeter(nextMeter: Meter) {
    setMeter(nextMeter);
    setPlacedNotes([]);
    setSelectedMaterial(null);
    setScreen("build");
    setFeedback(`${getMeterLabel(nextMeter)} 주문이 도착했어요. 목표는 ${nextMeter.beatsPerBar}박입니다.`);
  }

  function placeNote(note: NoteValue) {
    const nextTotal = check.totalUnits + UNITS[note];
    if (nextTotal > targetUnits) {
      setFeedback(`${formatUnits(nextTotal - targetUnits)}박을 넘었어요. 긴 재료 하나를 바꿔 볼까요?`);
      setScreen("build");
      vibrate([20, 40, 20]);
      return;
    }
    setPlacedNotes((current) => [...current, note]);
    setSelectedMaterial(null);
    setFeedback(nextTotal === targetUnits ? "딱 맞아요! 리듬을 확인하고 연주를 시작해 보세요." : `${formatUnits(targetUnits - nextTotal)}박이 더 필요해요.`);
    getAudio().click(nextTotal === targetUnits ? "bright" : "soft");
    vibrate();
  }

  function handleSlotTap(slotIndex: number) {
    if (!selectedMaterial) {
      setFeedback("먼저 아래 재료 카드를 고른 뒤, 빈 박을 눌러 주세요.");
      return;
    }
    if (slotIndex * 4 > check.totalUnits && check.totalUnits !== 0) {
      setFeedback("앞에서부터 빈 박을 채워 보세요. 순서가 리듬의 흐름이 됩니다.");
      return;
    }
    placeNote(selectedMaterial);
  }

  function removeNote(index: number) {
    setPlacedNotes((current) => current.filter((_, noteIndex) => noteIndex !== index));
    setFeedback("재료를 바꿨어요. 다시 길이의 합을 확인해 보세요.");
    setScreen("build");
  }

  function undoLast() {
    if (!placedNotes.length) return;
    removeNote(placedNotes.length - 1);
  }

  async function previewPattern() {
    if (!placedNotes.length || isPreviewing) return;
    setIsPreviewing(true);
    await getAudio().playPattern(createScheduledNotes(placedNotes), 1, () => setIsPreviewing(false));
  }

  function checkRecipe() {
    if (check.status === "empty") {
      setFeedback("조리대가 비어 있어요. 재료를 하나 넣어 보세요.");
    } else if (check.status === "short") {
      setFeedback(`아직 ${formatUnits(check.differenceUnits)}박이 비어 있어요. 빈 박을 빛나게 채워 주세요.`);
      vibrate([18, 40, 18]);
    } else if (check.status === "over") {
      setFeedback(`${formatUnits(Math.abs(check.differenceUnits))}박을 넘었어요. 긴 재료 하나를 바꿔 볼까요?`);
      vibrate([20, 40, 20]);
    } else {
      setFeedback("마디 완성! 음표의 개수가 아니라 길이의 합이 정확히 맞았어요.");
      getAudio().click("bright");
      vibrate([25, 45, 25]);
    }
  }

  async function startPractice() {
    if (check.status !== "exact") {
      checkRecipe();
      return;
    }
    const audio = getAudio();
    await audio.unlock();
    const barSeconds = targetUnits * audio.secondsPerUnit;
    const startAt = audio.now() + 0.08;
    practiceStartRef.current = startAt;
    const oneBarTargets = createScheduledNotes(placedNotes).map((note) => note.startUnit * audio.secondsPerUnit);
    expectedTimesRef.current = [...oneBarTargets, ...oneBarTargets.map((time) => time + barSeconds)];
    usedTargetsRef.current = new Set();
    gradesRef.current = [];
    setGrades([]);
    setLastJudgement(null);
    setPracticeProgress(0);
    setPracticeActive(true);
    setScreen("practice");
    setFeedback("두 마디 동안 박자에 맞춰 드럼을 눌러 보세요.");
    await audio.playPattern(createScheduledNotes(placedNotes), 2);
    finishTimeoutRef.current = window.setTimeout(finishPractice, (barSeconds * 2 + 0.4) * 1000);
  }

  function finishPractice() {
    if (!practiceActive && screen !== "practice") return;
    setPracticeActive(false);
    setPracticeProgress(1);
    setScreen("result");
    setFeedback("연주가 끝났어요. 이제 소리와 규칙을 함께 돌아볼까요?");
    setResultTotal(null);
  }

  function handleDrumTap() {
    if (!practiceActive) return;
    const audio = getAudio();
    const elapsed = audio.now() - practiceStartRef.current;
    const targets = expectedTimesRef.current;
    const targetIndex = getNextTargetIndex(targets, elapsed);
    if (targetIndex < 0 || usedTargetsRef.current.has(targetIndex)) return;
    usedTargetsRef.current.add(targetIndex);
    const deltaMs = (elapsed - targets[targetIndex]) * 1000;
    const grade = judgeTiming(deltaMs, latencyMs);
    const nextGrades = [...gradesRef.current, grade];
    gradesRef.current = nextGrades;
    setGrades(nextGrades);
    setLastJudgement(grade);
    getAudio().click(grade === "Perfect" ? "bright" : "soft");
    vibrate(grade === "Miss" ? [12, 30, 12] : 12);
  }

  function submitQuiz() {
    if (!quizAnswer || resultSaved) return;
    const theory = quizAnswer === "4" ? 100 : 0;
    const total = Math.round(50 + timingScore * 0.3 + theory * 0.2);
    const stars = total >= 90 ? 3 : total >= 70 ? 2 : 1;
    const nextProgress = {
      bestScore: Math.max(progress.bestScore, total),
      stars: progress.stars + stars,
      wrongTypes: quizAnswer === "4" ? progress.wrongTypes : { ...progress.wrongTypes, theory: (progress.wrongTypes.theory ?? 0) + 1 },
    };
    window.localStorage.setItem("measure-recipe-progress", JSON.stringify(nextProgress));
    setProgress(nextProgress);
    setResultTotal(total);
    setResultSaved(true);
  }

  function restartCurrentLevel() {
    if (finishTimeoutRef.current) window.clearTimeout(finishTimeoutRef.current);
    setPlacedNotes([]);
    setSelectedMaterial(null);
    setPracticeActive(false);
    setPracticeProgress(0);
    setGrades([]);
    setQuizAnswer(null);
    setResultTotal(null);
    setResultSaved(false);
    setScreen("build");
    setFeedback(level.prompt);
  }

  return (
    <main className={`app-shell ${lowSensory ? "is-low-sensory" : ""}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">M</div>
          <div>
            <p className="eyebrow">MELODIA · RHYTHM LAB</p>
            <h1>마디 레시피 공방</h1>
          </div>
        </div>
        <div className="top-actions">
          <div className="streak-chip"><span className="spark">✦</span><span>{progress.stars}</span><small>별</small></div>
          <button className="icon-button" type="button" onClick={() => setIsSettingsOpen(true)} aria-label="설정 열기">☷</button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="lesson-rail" aria-label="레벨 선택">
          <div className="rail-heading"><span>오늘의 공방</span><span className="rail-count">{levelIndex + 1}/8</span></div>
          <div className="level-list">
            {LEVELS.map((item, index) => (
              <button key={item.id} type="button" className={`level-item ${index === levelIndex ? "is-current" : ""}`} onClick={() => selectLevel(index)}>
                <span className="level-number">{String(item.id).padStart(2, "0")}</span>
                <span className="level-copy"><strong>{item.name}</strong><small>{item.lesson}</small></span>
                {index < levelIndex ? <span className="level-state">✓</span> : index === levelIndex ? <span className="level-state current-dot">●</span> : null}
              </button>
            ))}
          </div>
          <div className="rail-note">
            <span className="note-pin">◎</span>
            <div><strong>오늘의 원칙</strong><p>음표 개수가 아니라<br />길이의 합을 세어요.</p></div>
          </div>
        </aside>

        <section className="workspace" aria-live="polite">
          <div className="workspace-head">
            <div>
              <p className="section-kicker">{screen === "build" ? "STEP 02 · 조립" : screen === "practice" ? "STEP 03 · 연주" : "STEP 04 · 확인"}</p>
              <h2>{screen === "build" ? "오늘의 주문을 채워요" : screen === "practice" ? "완성한 리듬을 연주해요" : "나의 리듬을 확인해요"}</h2>
            </div>
            <div className="meter-switcher" aria-label="박자표 선택">
              {[2, 3, 4].map((beats) => (
                <button key={beats} type="button" className={meter.beatsPerBar === beats ? "is-active" : ""} onClick={() => selectMeter({ beatsPerBar: beats, beatUnit: 4 })}>{beats}/4</button>
              ))}
            </div>
          </div>

          {screen === "build" && (
            <div className="build-screen">
              <article className="order-card">
                <div className="order-card-top"><span className="order-label">TODAY&apos;S ORDER</span><span className="order-code">#0{level.id} / {getMeterLabel(meter)}</span></div>
                <div className="order-main">
                  <div className="order-seal">{meter.beatsPerBar}<small>박</small></div>
                  <div><h3>{getMeterLabel(meter)} 마디를 완성해 주세요</h3><p>{level.prompt}</p></div>
                </div>
                <div className="order-foot"><span className="tiny-icon">♧</span><span>목표 길이 <strong>{formatUnits(targetUnits)}박</strong></span><span className="dot-divider" /><span>재료 {level.available.length}종</span></div>
              </article>

              <section className={`countertop-panel ${check.status}`}>
                <div className="panel-heading"><div><span className="panel-kicker">RHYTHM COUNTERTOP</span><h3>조리대</h3></div><div className={`sum-display ${check.status}`}><strong>{formatUnits(check.totalUnits)}</strong><span>/ {formatUnits(targetUnits)} 박</span></div></div>
                <div className="countertop-wrap">
                  <div className="countertop-grid" style={{ gridTemplateColumns: `repeat(${activeBeatCount}, minmax(0, 1fr))` }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const note = event.dataTransfer.getData("text/note") as NoteValue; if (note) placeNote(note); }}>
                    {Array.from({ length: activeBeatCount }, (_, index) => (
                      <button key={index} type="button" className={`beat-cell ${selectedMaterial ? "can-receive" : ""}`} onClick={() => handleSlotTap(index)} aria-label={`${index + 1}번째 빈 박에 ${selectedMaterial ? NOTE_META[selectedMaterial].name : "재료"} 놓기`}>
                        <span className="beat-number">{String(index + 1).padStart(2, "0")}</span><span className="beat-word">박</span>
                      </button>
                    ))}
                    {segments.map((segment) => (
                      <button key={`${segment.note}-${segment.index}`} type="button" className="placed-note" style={{ left: `${(segment.startUnit / targetUnits) * 100}%`, width: `${(segment.durationUnits / targetUnits) * 100}%`, backgroundColor: NOTE_META[segment.note].color }} onClick={() => removeNote(segment.index)} aria-label={`${NOTE_META[segment.note].name}, 눌러서 제거`}>
                        <span className="placed-glyph">{NOTE_META[segment.note].glyph}</span><span>{NOTE_META[segment.note].shortName}</span><small>{formatUnits(segment.durationUnits)}박</small>
                      </button>
                    ))}
                  </div>
                  <div className="countertop-footer"><span className="countertop-tip"><span className="tip-dot" /> {selectedMaterial ? `${NOTE_META[selectedMaterial].name}을(를) 놓을 빈 박을 선택하세요` : "음표를 놓은 뒤 다시 누르면 제거돼요"}</span><span className="target-caption">{getMeterLabel(meter)} = {formatUnits(targetUnits)}박</span></div>
                </div>
                <div className={`feedback-box ${check.status}`}><span className="feedback-icon">{check.status === "exact" ? "✓" : check.status === "over" ? "!" : "i"}</span><p>{feedback}</p></div>
              </section>

              <section className="materials-section">
                <div className="section-row"><div><span className="panel-kicker">INGREDIENTS</span><h3>음표 재료</h3></div><span className="helper-text">카드 탭 → 빈 박 탭 · 드래그도 가능해요</span></div>
                <div className="material-grid">
                  {level.available.map((note) => {
                    const meta = NOTE_META[note];
                    return <button key={note} type="button" draggable onDragStart={(event) => event.dataTransfer.setData("text/note", note)} className={`material-card ${selectedMaterial === note ? "is-selected" : ""} ${meta.isRest ? "is-rest" : ""}`} onClick={() => setSelectedMaterial(selectedMaterial === note ? null : note)} aria-pressed={selectedMaterial === note}>
                      <span className="material-top"><span className="material-glyph">{meta.glyph}</span><span className="material-unit">{formatUnits(UNITS[note])}박</span></span><span className="material-name">{meta.name}</span><span className="material-sub">{meta.isRest ? "침묵" : "소리"}</span>
                    </button>;
                  })}
                </div>
              </section>

              <div className="build-actions"><button className="secondary-button" type="button" onClick={undoLast} disabled={!placedNotes.length}>↶ 되돌리기</button><button className="secondary-button" type="button" onClick={restartCurrentLevel}>↻ 다시 시작</button><button className="preview-button" type="button" onClick={previewPattern} disabled={!placedNotes.length || isPreviewing}><span>{isPreviewing ? "♪ 재생 중" : "▶ 리듬 미리듣기"}</span></button><button className="primary-button" type="button" onClick={check.status === "exact" ? startPractice : checkRecipe}>{check.status === "exact" ? "연주 시작 →" : "마디 확인하기 →"}</button></div>
            </div>
          )}

          {screen === "practice" && (
            <section className="practice-screen">
              <div className="practice-banner"><div><span className="panel-kicker">TWO BAR TAKE</span><h3>리듬을 몸으로 기억해요</h3><p>완성된 마디가 두 번 반복됩니다. 음표가 시작하는 순간에 드럼을 눌러 보세요.</p></div><div className="practice-meter"><strong>{getMeterLabel(meter)}</strong><span>2 bars</span></div></div>
              <div className="practice-progress"><div className="progress-label"><span>연주 진행</span><strong>{practiceActive ? `${Math.round(practiceProgress * 100)}%` : "준비 완료"}</strong></div><div className="progress-track"><span style={{ width: `${practiceProgress * 100}%` }} /></div></div>
              <div className="practice-stage"><div className="floating-note floating-note-one">♪</div><div className="floating-note floating-note-two">♩</div><div className="practice-staff"><StaffCanvas notes={placedNotes} meter={meter} compact /></div><div className="drum-zone"><button className={`drum-button ${practiceActive ? "is-active" : ""}`} type="button" onPointerDown={handleDrumTap} onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); handleDrumTap(); } }} disabled={!practiceActive} aria-label="드럼 치기"><span className="drum-rim"><span className="drum-center">{practiceActive ? "TAP" : "READY"}</span></span></button><span className="drum-hint">{practiceActive ? "음표가 시작할 때 톡!" : "아래 버튼으로 시작하세요"}</span></div></div>
              <div className="judgement-live"><span className="live-label">LIVE JUDGEMENT</span><strong className={lastJudgement?.toLowerCase() ?? "empty"}>{lastJudgement ?? "—"}</strong><span>{grades.length} hits · Perfect ±70ms · Good ±130ms</span></div>
              <div className="practice-actions"><button className="secondary-button" type="button" onClick={restartCurrentLevel}>← 조립으로 돌아가기</button>{!practiceActive && practiceProgress === 0 ? <button className="primary-button" type="button" onClick={startPractice}>▶ 두 마디 시작하기</button> : null}</div>
            </section>
          )}

          {screen === "result" && (
            <section className="result-screen">
              <div className="result-hero"><div className="result-star">✦</div><div><span className="panel-kicker">RECIPE COMPLETE</span><h3>멋진 마디가 완성됐어요</h3><p>소리의 길이와 박자표의 약속을 모두 지켰습니다.</p></div><div className="result-total"><strong>{resultTotal ?? "—"}</strong><span>/ 100</span></div></div>
              <div className="result-grid"><article className="theory-card"><div className="section-row"><div><span className="panel-kicker">SHEET MUSIC</span><h3>내가 만든 악보</h3></div><span className="mini-chip">{getMeterLabel(meter)} · {formatUnits(targetUnits)}박</span></div><div className="result-staff-wrap"><StaffCanvas notes={placedNotes} meter={meter} /></div><div className="explain-row"><span className="explain-icon">i</span><p>이 마디는 <strong>{formatUnits(targetUnits)}박</strong>이에요. 음표 개수가 아니라 각 재료의 시간 길이를 더해서 맞췄어요.</p></div></article><article className="score-card"><span className="panel-kicker">YOUR TAKE</span><h3>오늘의 기록</h3><div className="score-lines"><div><span>조립 정확성</span><strong>100<span>%</span></strong><i><em style={{ width: "100%" }} /></i></div><div><span>연주 정확성</span><strong>{timingScore}<span>%</span></strong><i><em style={{ width: `${timingScore}%` }} /></i></div><div><span>이론 이해도</span><strong>{theoryScore}<span>%</span></strong><i><em style={{ width: `${theoryScore}%` }} /></i></div></div><div className="score-divider" /><div className="best-record"><span>최고 점수</span><strong>{Math.max(progress.bestScore, calculatedTotal)}<small>점</small></strong></div></article></div>
              <article className="quiz-card"><div><span className="panel-kicker">ONE LAST CHECK</span><h3>4/4 한 마디의 길이 합은 몇 박일까요?</h3><p>오늘 배운 규칙을 새로운 상황에 적용해 보세요.</p></div><div className="quiz-options">{["2", "4", "8"].map((answer) => <button key={answer} type="button" onClick={() => setQuizAnswer(answer)} className={quizAnswer === answer ? "is-selected" : ""}><strong>{answer}박</strong><span>{answer === "2" ? "반 마디" : answer === "4" ? "한 마디" : "두 마디"}</span></button>)}</div><button className="primary-button quiz-submit" type="button" disabled={!quizAnswer || resultSaved} onClick={submitQuiz}>{resultSaved ? "기록 저장 완료 ✓" : "정답 확인하기 →"}</button></article>
              <div className="result-actions"><button className="secondary-button" type="button" onClick={restartCurrentLevel}>↻ 같은 주문 다시하기</button><button className="primary-button" type="button" onClick={() => selectLevel(Math.min(levelIndex + 1, LEVELS.length - 1))}>다음 레시피로 →</button></div>
            </section>
          )}
        </section>

        <aside className="insight-panel">
          <div className="insight-header"><span className="panel-kicker">LEARNING LOG</span><span className="status-dot">LIVE</span></div>
          <div className="concept-card"><span className="concept-icon">∑</span><div><strong>길이의 합</strong><p>모양이 다른 음표도<br />시간은 서로 바꿀 수 있어요.</p></div></div>
          <div className="conversion-list"><div><span className="conversion-glyph">𝅗𝅥</span><span>2분음표</span><b>2박</b></div><div><span className="conversion-glyph">♩</span><span>4분음표</span><b>1박</b></div><div><span className="conversion-glyph">♪</span><span>8분음표 2개</span><b>1박</b></div></div>
          <div className="mini-progress"><div className="progress-label"><span>공방 진척도</span><strong>{levelIndex + 1}/8</strong></div><div className="progress-track"><span style={{ width: `${((levelIndex + 1) / LEVELS.length) * 100}%` }} /></div><p>다음: {LEVELS[Math.min(levelIndex + 1, LEVELS.length - 1)].lesson}</p></div>
          <div className="shortcut-card"><span>TIP</span><p><kbd>SPACE</kbd> 드럼 치기<br /><kbd>R</kbd> 다시 시작</p></div>
        </aside>
      </div>

      {isSettingsOpen && <div className="modal-backdrop" role="presentation" onClick={() => setIsSettingsOpen(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="panel-kicker">WORKSHOP SETTINGS</span><h2 id="settings-title">플레이 설정</h2></div><button className="icon-button" type="button" onClick={() => setIsSettingsOpen(false)} aria-label="설정 닫기">×</button></div><label className="setting-toggle"><span><strong>소리</strong><small>리듬과 판정 효과음</small></span><input type="checkbox" checked={!muted} onChange={(event) => setMuted(!event.target.checked)} /><i /></label><label className="setting-toggle"><span><strong>진동</strong><small>탭 판정 피드백</small></span><input type="checkbox" checked={haptic} onChange={(event) => setHaptic(event.target.checked)} /><i /></label><label className="setting-toggle"><span><strong>저감각 모드</strong><small>움직임과 펄스 줄이기</small></span><input type="checkbox" checked={lowSensory} onChange={(event) => setLowSensory(event.target.checked)} /><i /></label><label className="range-setting"><span><strong>오디오 지연 보정</strong><small>{latencyMs > 0 ? "+" : ""}{latencyMs}ms · Perfect ±70ms</small></span><input type="range" min="-200" max="200" step="10" value={latencyMs} onChange={(event) => setLatencyMs(Number(event.target.value))} /></label><button className="primary-button modal-close" type="button" onClick={() => setIsSettingsOpen(false)}>저장하고 돌아가기</button></section></div>}
    </main>
  );
}
