import React, { useId } from 'react';
import { useProjects } from './ProjectContext';
import { topicChoices } from '../../config/topics';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> {
  value: string;
  onChange: (value: string) => void;
}

/** "Konu": a suggestion list (the shared topics, then the teacher's own) while typing; any topic may be typed. */
export function TopicInput({ value, onChange, ...input }: Props) {
  const { projects } = useProjects();
  const listId = useId();
  return (
    <>
      <input {...input} list={listId} value={value} onChange={e => onChange(e.target.value)} autoComplete="off" />
      <datalist id={listId}>{topicChoices(projects.map(p => p.topic)).map(t => <option key={t} value={t} />)}</datalist>
    </>
  );
}
