import { projectRepository } from './projectRepository';
import { backupFileName, buildBackup, readBackup, type BackupProgress } from './backup';
import { saveFile } from '../../services/narration/browserMedia';
import type { QuestionProject } from '../../types';

/**
 * Downloads a ZIP backup: every question outside the recycle bin, or only the chosen ones.
 * Returns how many questions it holds.
 */
export async function downloadBackup(ids: string[] | null, onProgress?: (progress: BackupProgress) => void): Promise<number> {
  const all = await projectRepository.getAll();
  const chosen = all.filter(p => !p.deletedAt && (!ids || ids.includes(p.id)));
  if (!chosen.length) throw new Error('Yedeklenecek soru yok.');
  const zip = await buildBackup(chosen, undefined, onProgress);
  saveFile(zip, backupFileName(new Date(), ids ? `${chosen.length}-soru` : ''));
  return chosen.length;
}

/** The questions inside a backup ZIP the teacher picked, ready for `importProjects`. */
export async function openBackupFile(file: File): Promise<QuestionProject[]> {
  if (!/\.zip$/i.test(file.name) && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed')
    throw new Error('Lütfen daha önce indirdiğiniz yedek ZIP dosyasını seçin.');
  return readBackup(await file.arrayBuffer());
}
