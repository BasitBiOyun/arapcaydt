import type { QuestionProject } from '../../../types';
import { QUESTION_CATEGORIES } from '../../../config/categories';
import { CollectionInput } from '../../projects/CollectionInput';
import { TopicInput } from '../../projects/TopicInput';

export interface ProjectInfoProps {
  hidden: boolean;
  currentProject: QuestionProject;
  updateCurrentProject: (updates: Partial<QuestionProject>) => void;
}

/** The question's name, category, exam, collection and topic (first two steps). */
export function ProjectInfo({ hidden, currentProject, updateCurrentProject }: ProjectInfoProps) {
  return (
    <details hidden={hidden} className="border rounded-lg p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Proje bilgileri</summary>
      <div className="space-y-3 pt-3">
        <label className="block">
          Proje adı
          <input
            value={currentProject.title}
            onChange={e => updateCurrentProject({ title: e.target.value })}
            className="block w-full border rounded p-2"
          />
        </label>
        <label className="block">
          Kategori
          <select
            className="block w-full border rounded p-2"
            value={currentProject.category}
            onChange={e => updateCurrentProject({ category: e.target.value })}
          >
            {QUESTION_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Sınav / yıl
          <input
            value={currentProject.examYear}
            onChange={e => updateCurrentProject({ examYear: e.target.value })}
            className="block w-full border rounded p-2"
          />
        </label>
        <label className="block">
          Koleksiyon / deneme adı
          <CollectionInput
            placeholder="Örnek: Eylül Denemesi 1"
            value={currentProject.examName || ''}
            onChange={examName => updateCurrentProject({ examName })}
            className="block w-full border rounded p-2"
          />
        </label>
        <label className="block">
          Konu
          <TopicInput
            placeholder="Örnek: İsm-i mevsul"
            value={currentProject.topic || ''}
            onChange={topic => updateCurrentProject({ topic: topic.trim() ? topic : undefined })}
            className="block w-full border rounded p-2"
          />
        </label>
      </div>
    </details>
  );
}
