import { ArrowLeft } from 'lucide-react'
import { Button } from './ui/button'

const BackButton = () => {
  return (
    <Button
      variant='ghost'
      className='mb-4 hover:bg-neutral-200'
      onClick={() => window.history.back()}
    >
      <ArrowLeft className='h-4 w-4' /> Back
    </Button>
  )
}

export default BackButton
