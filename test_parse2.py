import sys
sys.path.append('apps/backend')
from app.config.filename_parser import parse_question_paper_filename

res = parse_question_paper_filename("upsc-prelims-gs1-2019-set_a.pdf", exam_name="MPSC")
print(res)
