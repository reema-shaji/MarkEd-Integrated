interface RatingProps {
  rating: string[]
}

const descriptions = {
  irrelevant: 'The feedback is irrelevant to the text.',
  harsh: 'The feedback is harsh and not helpful.',
  incorrect: 'The feedback is incorrect.',
  accurate: 'The feedback is accurate.',
  unconstructive: 'The feedback is not constructive.',
  constructive:
    'Provides specific ways to improve rather than just criticizing',
  neutral: 'The feedback is neutral.',
  relevant: 'Relates directly to the task or performance being evaluated',
  actionable: 'Can be translated into concrete steps or changes',
  specific:
    'Focuses on particular instances or behaviors rather than generalizations',
  timely:
    'Given when the subject matter is still fresh and changes can be implemented',
  objective: 'Based on observable facts rather than personal bias',
  clear: 'Expressed in straightforward language without ambiguity',
  balanced: 'Acknowledges both strengths and areas for improvement',
  focused: 'Targets key areas rather than overwhelming with too many points',
  respectful: 'Maintains professional tone and consideration for the recipient',
  verifiable: 'Can be checked or measured against concrete evidence',
  contextual:
    'Takes into account the circumstances and constraints of the situation',
  vague: 'Uses unclear or general statements that cannot be acted upon',
  subjective:
    'Based primarily on personal feelings or biases rather than observable facts',
  delayed: 'Given too late to be useful or when details are no longer fresh',
  ambiguous: 'Open to multiple interpretations, creating confusion',
  unbalanced:
    'Focuses exclusively on negatives (or positives) while ignoring the other',
} as const

export default function Rating({ rating }: RatingProps) {
  return (
    <div className='flex flex-wrap gap-2'>
      {rating.map((r) => (
        <span
          key={r}
          className='rounded-full border border-border bg-muted px-3 py-2 text-sm'
          title={descriptions[r as keyof typeof descriptions]}
        >
          {r}
        </span>
      ))}
    </div>
  )
}
