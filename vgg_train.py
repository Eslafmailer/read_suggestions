# https://dataman-ai.medium.com/transfer-learning-for-image-classification-5-get-image-data-ready-and-go-554044a12e6d
# https://dataman-ai.medium.com/transfer-learning-for-image-classification-6-build-the-transfer-learning-model-67d87999af4a
# https://github.com/dataman-git/codes_for_articles/blob/master/20220804_Transfer_learning_for_Image_Classification.ipynb

import tensorflow as tf
import os
from tensorflow.keras.applications.vgg16 import preprocess_input

IMAGES_FOLDER = os.path.join('.', 'images')
IMAGE_SIZE = (224, 224)
IMAGE_SHAPE = (*IMAGE_SIZE, 3)
BATCH_SIZE = 32
NUM_EPOCHS = 15

# Load training and validation datasets
train_ds = tf.keras.utils.image_dataset_from_directory(
    IMAGES_FOLDER,
    label_mode='binary',           # binary labels: 0.0 or 1.0
    validation_split=0.2,
    subset="training",
    seed=42,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    IMAGES_FOLDER,
    label_mode='binary',
    validation_split=0.2,
    subset="validation",
    seed=42,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
)

# Apply VGG16 preprocessing to datasets
train_ds = train_ds.map(lambda x, y: (preprocess_input(x), y))
val_ds = val_ds.map(lambda x, y: (preprocess_input(x), y))

# Optimize input pipeline
AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.shuffle(1000).prefetch(buffer_size=AUTOTUNE)
val_ds = val_ds.prefetch(buffer_size=AUTOTUNE)

# Load VGG16 base model
VGG16_features=tf.keras.applications.VGG16(input_shape=IMAGE_SHAPE,
                                           include_top=False,
                                           weights='imagenet')

# Freeze all except last conv layer
for layer in VGG16_features.layers:
    if layer.name in ['block5_conv3']:
        layer.trainable = True
    else:
        layer.trainable = False

# Custom classification head for binary classification
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(input_shape=IMAGE_SHAPE),
    VGG16_features,
    tf.keras.layers.GlobalAveragePooling2D(),
    tf.keras.layers.Dense(64, activation='relu'),
    tf.keras.layers.Dense(1, activation='sigmoid')  # binary output
])

# Compile for binary classification
model.compile(
    optimizer=tf.keras.optimizers.Adam(),
    loss=tf.keras.losses.BinaryCrossentropy(),
    metrics=["accuracy"]
)
model.summary()

# Train the model
history = model.fit(
    train_ds,
    epochs=NUM_EPOCHS,
    validation_data=val_ds
)

# Save trained model
model.save(os.path.join('.', 'trained_binary_vgg'))

# Evaluate
loss0, accuracy0 = model.evaluate(val_ds)
print(f"loss: {loss0:.2f}")
print(f"accuracy: {accuracy0:.2f}")
