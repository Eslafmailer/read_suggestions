import tensorflow as tf
import os
import json
import base64
from tqdm import tqdm

FILES_FOLDER = os.path.join('.', 'files')
IMAGE_SIZE = (224, 224)
CHANNELS = 3
IMAGE_SHAPE = (*IMAGE_SIZE, CHANNELS)
BATCH_SIZE = 32
RESULT_FILE = 'cover-score.json'

model = tf.keras.models.load_model(os.path.join('.', 'trained_binary_vgg'))

def load_image(path):
    with open(path) as f:
        contents = f.read()

    # Decode from base64 string stored in file
    content = base64.b64decode(contents)
    img = tf.io.decode_image(content, channels=CHANNELS, expand_animations=False)
    img = tf.image.resize(img, IMAGE_SIZE)
    img.set_shape(IMAGE_SHAPE)
    return img


def predict(paths):
    images = [load_image(path) for path in paths]
    img_ds = tf.data.Dataset.from_tensor_slices(images)
    img_ds = img_ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)
    return model.predict(img_ds, verbose=0)  # shape: (N, 1)


def chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


with open('./db.json') as f:
    db = json.load(f)

ids = [x.get('id') for x in db.values()]
print('all entries', len(ids))
ids = [x for x in ids if os.path.isfile(os.path.join(FILES_FOLDER, str(x)))]
print('entries with image', len(ids))

result = []
resultSet = set()
if os.path.isfile(RESULT_FILE):
    with open(RESULT_FILE) as f:
        result = json.load(f)
    resultSet = {entry['id'] for entry in result}

for chunk in tqdm(list(chunks(ids, BATCH_SIZE))):
    chunk = [x for x in chunk if x not in resultSet]
    if not chunk:
        continue

    image_paths = [os.path.join(FILES_FOLDER, str(x)) for x in chunk]
    prediction = predict(image_paths)

    for idx, id in enumerate(chunk):
        item = {
            'id': id,
            'cover': float(prediction[idx][0])  # ✅ single sigmoid output
        }
        result.append(item)

with open(RESULT_FILE, "w") as outfile:
    json.dump(result, outfile, indent=4)
