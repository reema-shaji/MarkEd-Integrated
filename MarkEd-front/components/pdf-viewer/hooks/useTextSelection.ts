import { useState } from 'react'

function getAbsoluteCoordinates(element: HTMLElement | DOMRect) {
  const rect =
    element instanceof HTMLElement ? element.getBoundingClientRect() : element

  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop

  const absoluteY = rect.top + scrollTop
  const absoluteX = rect.left + scrollLeft

  return {
    y: absoluteY,
    x: absoluteX,
    width: rect.width,
    height: rect.height,
    relativeY: rect.top,
    relativeX: rect.left,
  }
}

export function useTextSelection() {
  const [selectedText, setSelectedText] = useState('')
  const [marginTextTop, setMarginTextTop] = useState('')
  const [marginTextBottom, setMarginTextBottom] = useState('')
  const [currentPageNumber, setCurrentPageNumber] = useState(1)
  const [currentBoundingRect, setCurrentBoundingRect] =
    useState<DOMRect | null>(null)

  const cleanupText = (text: string) => {
    return text
      .replace(/(\w+)-\s*(\w+)/g, (_, p1, p2) => {
        const commonHyphenatedWords = [
          'well-known',
          'state-of-the-art',
          'end-to-end',
          'real-time',
        ]
        const fullWord = `${p1}-${p2}`
        return commonHyphenatedWords.includes(fullWord.toLowerCase())
          ? fullWord
          : p1 + p2
      })
      .replace(/\s+/g, ' ')
      .replace(/ﬁ/g, 'fi')
      .replace(/ﬂ/g, 'fl')
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/"/g, '"')
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/\s+\)/g, ')')
      .replace(/\(\s+/g, '(')
      .trim()
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.toString().trim().length === 0) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Find PDF page element containing selection
    let element: Node | null = range.startContainer
    while (
      element &&
      !(
        element instanceof HTMLElement &&
        element.classList.contains('react-pdf__Page')
      )
    ) {
      element = element.parentNode
    }

    const pageElement = element as HTMLElement
    const pageRect = pageElement?.getBoundingClientRect()
    if (!pageElement || !pageRect) return

    // Calculate relative position
    const relativeRect = new DOMRect(
      rect.x - pageRect.x,
      getAbsoluteCoordinates(rect).y - getAbsoluteCoordinates(pageElement).y,
      rect.width,
      rect.height
    )
    setCurrentBoundingRect(relativeRect)

    // Get surrounding text
    const getSiblings = (
      node: Node,
      direction: 'previous' | 'next',
      minChars = 200
    ) => {
      const siblings: Node[] = []
      let current = node
      let totalChars = 0

      while (current[`${direction}Sibling`] && totalChars < minChars) {
        if (current[`${direction}Sibling`]?.nodeName === 'SPAN') {
          const siblingText = current[`${direction}Sibling`]?.textContent || ''
          totalChars += siblingText.length
          if (direction === 'previous') {
            siblings.unshift(current[`${direction}Sibling`] as Node)
          } else {
            siblings.push(current[`${direction}Sibling`] as Node)
          }
        }
        current = current[`${direction}Sibling`] as Node
      }
      return siblings
    }

    let startSpan = range.startContainer
    let endSpan = range.endContainer
    while (startSpan && startSpan.nodeName !== 'SPAN')
      startSpan = startSpan.parentNode as Node
    while (endSpan && endSpan.nodeName !== 'SPAN')
      endSpan = endSpan.parentNode as Node

    if (!startSpan || !endSpan) return

    // Get the full text of start and end spans
    const startSpanFullText = startSpan.textContent || ''
    const endSpanFullText = endSpan.textContent || ''

    // Get text before selection in start span
    const startOffset = range.startOffset
    const textBeforeSelection = startSpanFullText.slice(0, startOffset)

    // Get text after selection in end span
    const endOffset = range.endOffset
    const textAfterSelection = endSpanFullText.slice(endOffset)

    const previousText = (
      getSiblings(startSpan, 'previous', 200)
        .map((span) => span.textContent || '')
        .join(' ') +
      ' ' +
      textBeforeSelection
    ).slice(-500)

    const nextText = (
      textAfterSelection +
      ' ' +
      getSiblings(endSpan, 'next', 200)
        .map((span) => span.textContent || '')
        .join(' ')
    ).slice(0, 500)

    setMarginTextTop(cleanupText(previousText))
    setMarginTextBottom(cleanupText(nextText))
    setSelectedText(cleanupText(selection.toString()))
    setCurrentPageNumber(currentPageNumber)
  }

  return {
    selectedText,
    marginTextTop,
    marginTextBottom,
    currentPageNumber,
    currentBoundingRect,
    handleTextSelection,
    setCurrentPageNumber,
  }
}
