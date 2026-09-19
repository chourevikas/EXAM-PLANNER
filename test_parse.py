import sys
sys.path.append('apps/backend')
from app.config.filename_parser import parse_question_paper_filename

res = parse_question_paper_filename("mpsc-prelims-gs1-2024.pdf", exam_name="MPSC")
print(res)
