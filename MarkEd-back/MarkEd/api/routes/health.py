from ninja import Router

router = Router(auth=None)

@router.get("/health", auth=None)
def health(request):
    return {"status": "ok"}

@router.get("/ping", auth=None)
def ping(request):
    return {"status": "ok"} 