import type { QuestionProject } from '../../types';
import { pipelineDiagnostics } from '../../services/pipeline/localVideoPipeline';

/**
 * A question's teşhis record for "Sorun bildir": the last "İşaretleri hazırla" reading when it was
 * for this text (words the reader saw, boxes, timings), and the marks as saved now. The picture and
 * the voice stay in the question itself; the admin opens it from the report.
 */
export function reportSnapshot(project: QuestionProject | null) {
  if (!project) return undefined;
  const pipeline = pipelineDiagnostics();
  const fresh = pipeline && pipeline.solutionText === project.solutionText ? pipeline : null;
  const config = project.videoConfig || {} as QuestionProject['videoConfig'];
  const box = ({ id, type, label, x, y, width, height }: any) => ({ id, type, label, x, y, width, height });
  return {
    ...(fresh || { solutionText: project.solutionText, words: [], regions: (config.regions || []).map(box) }),
    report: {
      projectId: project.id, title: project.title, examName: project.examName, questionNumber: project.questionNumber,
      category: project.category, correctAnswer: project.correctAnswer, freshReading: !!fresh,
    },
    saved: {
      regions: (config.regions || []).map(box),
      timelineActions: config.timelineActions || [],
      warnings: config.warnings || [],
      timingQuality: config.timingQuality, ocrEngine: config.ocrEngine, ocrNote: config.ocrNote, passageNote: config.passageNote,
      narration: {
        type: project.narrationSource?.type, duration: project.narrationSource?.duration,
        words: (project.narrationSource?.words || project.audioNarration?.words || []).map(w => ({ text: w.text, start: w.start, end: w.end })),
      },
    },
  };
}
